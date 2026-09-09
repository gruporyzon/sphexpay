> Atualização: a persistência e o fluxo atuais são separados por modo. Consulte [Stripe Connect Test/Live](stripe-connect-test-live.md), incluindo a migration `20260909010000_stripe_connect_modes.sql`. Descrições de vínculo único/ausência de criação no onboarding abaixo são históricas.

# Diagnóstico de onboarding Stripe Connect — 2026-09-08

## Investigação específica de 502/503 — estado local atual

Esta seção prevalece sobre as classificações HTTP históricas abaixo. Nenhum commit, push, deploy, chamada autenticada remota ou alteração de variáveis foi executado nesta investigação. Os logs brutos da tentativa Vercel e o erro Stripe original ainda não foram fornecidos. Os documentos anteriores registram a falha de constraint 23514 já corrigida e o erro público de Account Link; não registram uma causa Stripe confirmada.

### Conclusão e hipótese prioritária

Foi reconfirmado lendo `git show HEAD:server/stripe/connect.js` que o commit HEAD passa apenas `['recipient']` ao Account Link, enquanto o código local passa `['merchant','recipient']` e a criação pede ambas as configurações. Se o deployment com falha corresponde ao HEAD, a hipótese prioritária é `configs_must_match_to_use_account_links`. A [referência oficial](https://docs.stripe.com/api/v2/core/account-links/create) também lista `accounts_v2_access_blocked` (400), `not_found` (404) e `account_rate_limit_exceeded` (429). Não foi confirmado qual código a Stripe retornou nem qual versão está publicada; não se alteraram configurações por suposição.

`account=200` pode apenas reutilizar uma conta já vinculada: nesse caminho não cria nem recupera a Account externamente (embora inicialize o cliente Stripe). `status=200` só comprova recuperação Stripe bem-sucedida se o JSON tiver `connected:true`, para o mesmo usuário/deployment/ambiente. Sem vínculo retorna 200 com `connected:false`. Com vínculo, o status usa `stripe.accounts.retrieve` v1, não Account Link v2. Portanto sucesso nas duas rotas não comprova acesso/parametrização de Account Links v2 nem valida APP_URL.

`STRIPE_PLATFORM_FEE_BPS`, `STRIPE_WEBHOOK_SECRET` e a configuração de pagamentos **não são consultados pelo onboarding**. Uma taxa inválida não explica seu 502/503. O teste agora comprova isso.

### Mapa completo do handler e classificação HTTP

| Etapa | Condição | Antes desta investigação | Agora, somente na rota onboarding |
| --- | --- | --- | --- |
| Antes do fluxo | Método diferente de POST | 405 | 405 |
| database_configuration | URL/chave Supabase ausentes | 503 | 500 (configuração interna) |
| authenticate | Bearer ausente, expirado ou usuário inválido | 401 | 401 |
| authenticate | Supabase Auth retorna 5xx/AuthRetryableFetchError | 401 | 503 (dependência indisponível) |
| find_connection | Tabela/coluna/constraint/permissão inválida, SQLSTATE 42/23 ou PGRST20x | 503 | 500 (schema/configuração interna) |
| find_connection | Falha temporária de consulta Supabase | 503 | 503 |
| validate_connection | Vínculo não existe | 409 | 409 |
| validate_connection | Vínculo pertence a outro usuário | 403 | 403 |
| validate_connection | ID persistido não corresponde a `^acct_[A-Za-z0-9]+$` | 503 | 500 (dado interno inválido) |
| validate_urls | APP_URL ausente/inválida; credenciais na URL; protocolo não permitido; loopback em produção | 503 | 500 |
| stripe_configuration | STRIPE_SECRET_KEY ausente | 502 genérico | 500, etapa explícita |
| create_account_link | Chave inválida, permissão insuficiente, Accounts v2 bloqueado, parâmetros inválidos enviados pelo servidor | 502 | 500; HTTP Stripe 400/401/403 fica no log |
| create_account_link | Conta/recurso inexistente no contexto da chave (Stripe 404) | 502 | 409; verificar plataforma e modo antes de reconciliar |
| create_account_link | Stripe limita requisições (429) | 502 | 503 |
| create_account_link | Stripe 5xx, erro de conexão sem timeout ou resposta de link inválida | 502 | 502 |
| create_account_link | Timeout identificado pelo SDK | 502 | 504 |
| Qualquer etapa | Exceção interna inesperada | 502 genérico | 500 |

O frontend recebe somente `success`, código público da aplicação e mensagem pública. O code/type/status/request_id Stripe e a causa original não são serializados. O erro original é preservado como `cause` não enumerável para diagnóstico, sem mudar o contrato das outras rotas. A distinção Auth indisponível/expirado é compartilhada pelos handlers Connect que usam `authenticate`.

O handler não chama `accounts.retrieve`, não grava account ID e não cria Account. Um ID sintaticamente válido, mas inexistente na Stripe, é verificado pela própria chamada de Account Link. Nenhuma consulta externa adicional foi adicionada. Flags false antes de concluir onboarding não bloqueiam o link. Erros da infraestrutura Vercel anteriores ao handler (importação, inicialização, timeout/indisponibilidade da função) podem ter resposta e logs próprios, sem JSON `success/code/message`; não são classificáveis por este catch.

### Logs para procurar na Vercel

Filtrar o deployment/ambiente correto, `POST /api/stripe/connect/onboarding` e o horário da falha. Procurar:

- `[Stripe Connect][Onboarding context]`: referência parcial da conta, URLs efetivas sem query/credenciais, ambiente Vercel, origem da configuração e modo test/live/unknown da chave. Não registra a chave.
- `[Stripe Connect][Onboarding]` com `operation=onboarding.<etapa>`: `diagnostic_id` gerado pelo servidor, `stage`, `connection_exists` (null enquanto desconhecido), `onboarding_action`, `account_creation=false`, `link_action=create_account_link`, `type`, `code`, `param`, `stripe_http_status`, `response_status`, `request_id`. `stripe_http_status` é separado do status HTTP devolvido pela aplicação. Campo legado `statusCode` pode representar o status do erro local; usar os campos explícitos novos.
- O registro da biblioteca com `operation=v2.core.accountLinks.create` permanece; o registro da rota agora também conserva a causa Stripe e acrescenta etapa/contexto, permitindo entender a falha em uma única entrada.
- `[Stripe Connect][Supabase persistence]`: SQLSTATE/PGRST e diagnóstico permitido, com detalhes livres ocultados.

`onboarding_action=resume_existing_account` significa reutilização de vínculo, não prova que o usuário já abriu um link. Não existe histórico persistido que diferencie primeiro link de uma retomada parcial; cada chamada cria um novo Account Link para a mesma conta. Sem vínculo, a ação fica `not_started`. Não inventamos esse histórico.

Campos técnicos são filtrados, mensagens livres desconhecidas ficam `[REDACTED]`; não há dump de error/raw/headers/stack/body. Segredos, bearer, dados pessoais e URL de acesso Stripe não são registrados. `diagnostic_id` correlaciona contexto e erro da mesma execução; `request_id` permite localizar a mensagem original no Stripe Workbench. Falha do logger não substitui a resposta pública.

### Preview versus Production

Conferir `STRIPE_SECRET_KEY`, `APP_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`/`VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no ambiente do deployment que falhou, inclusive eventual override por branch. A chave deve pertencer à mesma plataforma e Test/Sandbox da conta persistida. Não trocar a chave para live para contornar conta inexistente.

A ordem atual de origem foi preservada: APP_URL → VERCEL_PROJECT_PRODUCTION_URL → VERCEL_URL. A variável de domínio de produção pode existir em Preview; por isso o fallback pode mandar o retorno para Production. Isso é demonstrado por teste e agora aparece em `app_url_source`/`vercel_environment`. Definir APP_URL explicitamente com a origem HTTPS de homologação. Não usar NODE_ENV para distinguir Preview de Production: o handler já verifica NODE_ENV=production para restringir URLs locais, mas os logs usam VERCEL_ENV. [Variáveis oficiais Vercel](https://vercel.com/docs/environment-variables/system-environment-variables).

URL HTTPS válida apontando para projeto/domínio errado pode ser aceita na criação e falhar apenas no retorno: não é, isoladamente, prova da causa do POST 502. Conferir também a proteção de acesso do Preview e a sessão Supabase nesse domínio. O timeout SDK é 5000 ms e maxNetworkRetries=0; não foi aumentado sem evidência de latência. O SDK pode repetir uma conexão fechada excepcionalmente mesmo com retries=0, conforme seu código instalado.

### Arquivos e validação desta investigação

Alterados nesta etapa: `api/stripe/connect/onboarding.js`, `server/stripe/connect.js`, `server/stripe/onboardingDiagnostics.js`, `src/test/stripeConnectOnboarding.test.ts` e este documento. `server/stripe/client.js` e `src/services/stripeConnectService.ts` foram revisados e preservados. Nenhuma migration foi criada ou alterada nesta etapa.

`npm test -- src/test/stripeConnect`: 105 testes passaram antes do último caso adicional v2. Validação final `npm test -- src/test/stripe`: **154 testes passaram em 8 arquivos**. `npm run typecheck`, `npm run lint`, `npm run build` e `git diff --check` passaram. O build manteve avisos de chunk auth vazio e tamanho de chunks. Foram cobertos chave ausente, HTTP Stripe 400/401/403/404/429/500, RateLimitError v2, timeout, indisponibilidade Auth/Supabase, configuração Preview, taxa inválida sem interferir, redaction e falha do logger.

Esses testes usam transporte simulado e PostgreSQL local; não comprovam funcionamento do deployment Vercel. A causa exata remota e o sucesso real do onboarding continuam pendentes dos logs sanitizados solicitados e da execução do roteiro abaixo no ambiente de testes.

### Homologação exata em Stripe Test Mode

1. Agora, sem publicar nada: identificar o deployment/commit que apresentou falha e obter seu log Vercel e JSON público. Conferir se `status` tinha `connected:true`, mesmo usuário, mesma origem e horário. Se houver request_id, abrir Stripe Workbench/Logs e localizar `POST /v2/core/account_links`; registrar apenas type/code/HTTP/request_id sanitizados.
2. Conferir a plataforma Test/Sandbox e a conta existente no Dashboard Stripe. Confirmar que o ID corresponde ao vínculo no Supabase do deployment com o script somente leitura `docs/sql/stripe-connect-onboarding-state.sql`. Para formato/schema usar os outros scripts de inspeção existentes. Não criar outra conta ou apagar a reserva.
3. Conferir variáveis do ambiente de homologação conforme a seção acima. APP_URL deve ser a origem HTTPS usada pelo navegador. Verificar acesso v2 e configurações merchant/recipient da conta. Para testar só onboarding não é necessário configurar taxa ou webhook.
4. As melhorias locais só aparecerão na Vercel após uma futura publicação expressamente autorizada. Nenhum deploy foi feito agora. Não atribuir os novos logs/status ao deployment atual. Se a versão já publicada for suficiente para o teste, usar seus logs existentes; caso contrário, aguardar a publicação de homologação autorizada.
5. Entrar na SphexPay nesse domínio com usuário de teste e abrir Financeiro. Para vínculo existente, clicar Continuar configuração: esperar um POST de onboarding, 200 e redirecionamento ao domínio Stripe. Somente para usuário de teste comprovadamente sem conta, a UI chama account antes; confirmar persistência antes do link.
6. Preencher somente dados de teste aceitos pela Stripe. Abandonar e retomar: deve continuar usando o mesmo account ID. Para testar link expirado/já usado, reabri-lo privadamente no navegador e verificar passagem por `/app/financeiro/stripe/refresh`, novo POST autenticado e novo link; nunca compartilhar/copiar a URL em logs ou tickets.
7. Concluir onboarding: `/app/financeiro/stripe/return` deve chamar status e voltar ao Financeiro. Conferir no Supabase `details_submitted`, `charges_enabled`, `payouts_enabled`, requirements e capabilities contra o Dashboard Stripe. Estado pendente/em análise pode ser legítimo; retorno 200 não implica flags true.
8. Se falhar, parar a repetição automática e capturar etapa + status público + Stripe type/code/HTTP/request_id. Usar a tabela para diferenciar configuração, recurso/ambiente, dependência e timeout. Não renovar reservas nem recriar Account para corrigir Account Link.

> Atualização da continuação de 08/09/2026: o endpoint de onboarding atual apenas consulta o vínculo persistido; sem vínculo retorna 409 e não cria conta. A criação é exclusiva do endpoint `/api/stripe/connect/account`. Os trechos abaixo que descrevem `ensureConnectedAccount` dentro do onboarding são históricos. Consulte o estado atual, a nova migration de integridade de pagamentos e a homologação pendente em [stripe-integration.md](stripe-integration.md). Nenhum estado remoto foi reconfirmado nesta continuação.

A correção remota da constraint de account ID foi confirmada pelo usuário. Nenhuma constraint, migration, configuração da Stripe ou dado remoto foi alterado neste trabalho.

## Estágio identificado e limite da evidência

A mensagem `Não foi possível abrir a configuração da Stripe agora.` nasce exclusivamente no catch de `createOnboardingLink`, em `server/stripe/connect.js`. A rota `POST /api/stripe/connect/onboarding` responde HTTP 502 com `{success:false,code:'ONBOARDING_LINK_FAILED',message:...}`. Antes desta alteração local, o catch descartava completamente o erro original. Pode ser uma rejeição Stripe, timeout, conexão ou exceção do SDK; não é possível distinguir pela mensagem pública.

O último commit local usa somente `configurations: ['recipient']` no link; o checkout já estava alterado antes deste trabalho para `['merchant','recipient']`. A criação da Account pede merchant e recipient nas duas versões. Se o deployment usar a versão do commit, essa divergência é uma hipótese concreta para `configs_must_match_to_use_account_links`. Não foi confirmado qual versão roda na Vercel, nem recebido esse código no erro real. Não houve nova alteração nas configurações neste trabalho.

Não foram fornecidos logs remotos completos nem realizada chamada à Stripe. A causa da rejeição em produção permanece não confirmada. A chamada v2 e seus parâmetros locais são compatíveis com o contrato documentado; não se deve presumir erro em configurations ou mudar a API sem evidência.

## Fluxo real, arquivo por arquivo

1. `src/components/finance/StripeConnectCard.tsx`: ao montar, `load()` chama `stripeConnectService.status()`. `busy` bloqueia cliques concorrentes na mesma instância.
2. `src/services/stripeConnectService.ts`: obtém a sessão Supabase e envia bearer para `GET /api/stripe/connect/status`.
3. `api/stripe/connect/status.js`: autentica e busca vínculo por `user_id`. Sem vínculo, retorna `connected:false`. Com vínculo, chama a leitura/sincronização já existente em `retrieveAndSync` e retorna status. Essa leitura usa `stripe.accounts.retrieve` (v1 preexistente); não foi introduzida nem alterada por esta correção. A criação de conta e o onboarding permanecem v2.
4. No clique, `StripeConnectCard.start()` chama primeiro `POST /api/stripe/connect/account` somente se o estado do componente estiver desconectado. Se já estiver conectado, chama diretamente `POST /api/stripe/connect/onboarding`.
5. `api/stripe/connect/account.js`: autentica, chama `ensureConnectedAccount` e retorna status seguro.
6. `server/stripe/connect.js`, `ensureConnectedAccount`: consulta `stripe_connected_accounts` por usuário autenticado. Se há vínculo, retorna a mesma conta; adicionada verificação defensiva de que o registro pertence a esse usuário. Não usa account ID ou user ID do body do cliente.
7. Sem vínculo, usa `reserve_stripe_account` e chave `sphex-connect-` + SHA-256 do usuário para criar/recuperar a Account v2. Persiste com upsert por `user_id`, aguarda `select(...).single()` e só retorna após sucesso. Falha interrompe o fluxo.
8. `api/stripe/connect/onboarding.js`: autentica novamente, chama o mesmo `ensureConnectedAccount` e então `createOnboardingLink`. Para uma conta recém-persistida no passo anterior, a busca reutiliza o vínculo.
9. `createOnboardingLink` chama `stripe.v2.core.accountLinks.create`, passando o ID do vínculo. Valida agora a URL da resposta antes de retornar. Nenhuma account session é criada.
10. A rota retorna HTTP 200 `{success:true,url}`. O serviço frontend propaga o JSON e `start()` redireciona com `window.location.assign(url)`. Em erro, o serviço lança apenas a mensagem pública recebida; o componente a exibe.
11. `src/App.tsx` registra `/app/financeiro/stripe/:mode` dentro de `ProtectedRoute`. `StripeConnectRedirect` usa `refresh` para pedir outro link autenticado e `return` para atualizar o status e voltar ao Financeiro. Refresh automático é limitado a três tentativas em dois minutos.

Depois de uma falha do link, o estado do componente pode ainda estar `connected:false`, mas a nova chamada de account consulta o vínculo antes de criar. A falha do link não remove a persistência.

## Contrato Stripe verificado

- SDK instalado: `stripe@22.6.1`.
- API padrão do SDK: `2026-08-26.dahlia`, confirmada em `node_modules/stripe/esm/apiVersion.js`. O cliente não configura override.
- `server/stripe/client.js`: usa a secret da plataforma exclusivamente no servidor; timeout 5000 ms, maxNetworkRetries 0. Não há header de connected account na criação do link. Valores de credenciais não foram lidos nem registrados.
- Método: `stripe.v2.core.accountLinks.create`.
- HTTP do SDK: `POST /v2/core/account_links`.
- `account`: `connection.stripe_account_id`.
- `use_case.type`: `account_onboarding`.
- `use_case.account_onboarding.configurations`: `['merchant','recipient']`.
- `collection_options.fields`: `eventually_due`.
- `refresh_url`: origem configurada + `/app/financeiro/stripe/refresh`.
- `return_url`: origem configurada + `/app/financeiro/stripe/return`.
- Origem: primeiro APP_URL; depois VERCEL_PROJECT_PRODUCTION_URL; depois VERCEL_URL. HTTPS obrigatório, exceto HTTP localhost. Credenciais em URL são rejeitadas. Configuração inválida produz erro próprio 503, anterior à chamada Stripe.

Fonte oficial: https://docs.stripe.com/api/v2/core/account-links/create

O contrato documenta configurations, collection_options e URLs usados no código. Dentre as rejeições possíveis, documenta `configs_must_match_to_use_account_links` e `accounts_v2_access_blocked`; nenhuma foi confirmada como causa real deste incidente. A versão do SDK/API efetivamente publicada não foi conferida remotamente.

## Estado persistido

`docs/sql/stripe-connect-onboarding-state.sql` é somente leitura. Substituir o UUID de exemplo pelo UUID do usuário autenticado e executar no projeto Supabase da aplicação. A consulta informa ausência/presença do vínculo, referência mascarada, validade do formato e os seis campos de estado solicitados.

O select do backend exige as colunas `user_id`, `stripe_account_id`, `stripe_account_type`, `stripe_capabilities`, `stripe_onboarding_status`, `stripe_details_submitted`, `stripe_charges_enabled`, `stripe_payouts_enabled`, arrays de requisitos e timestamps. O link usa o account ID; não exige que charges/payouts/details sejam true. `express`, `pending` e flags false são normais antes do onboarding. Não foi confirmada por consulta remota a existência da linha deste usuário.

## Mudanças locais

- `server/stripe/onboardingDiagnostics.js`: registra operação, type, code, param, message e request_id, sem serializar erro bruto, headers, request ou URL do link. Mensagens técnicas reconhecidas são preservadas. Texto livre não reconhecido é `[REDACTED]`, pois pode conter dados pessoais ou credenciais; o request_id permite consultar a mensagem original no Dashboard. Falha do logger não altera o erro público.
- `server/stripe/connect.js`: chama o diagnóstico no catch do link, rejeita URL ausente/inválida/não HTTPS/com credenciais e resposta de outra conta. Erro na consulta de vínculo passa pelo logger seguro de Supabase com operação `find_connection`. Verifica ownership do vínculo antes de gerar link. Parâmetros Stripe, chave idempotente, reservas, constraints e contrato público de erro permanecem iguais.
- `src/test/stripeConnectOnboarding.test.ts`: testa a rota real com Stripe e transporte Supabase simulados. As suítes PostgreSQL existentes verificam persistência real local.

## Retry e recuperação

Vínculo existente: sempre reutilizado, sem chamada de criação de Account. Sem vínculo: chave estável e parâmetros reservados são mantidos. Reserva com mais de 23 horas bloqueia e exige reconciliação; não é renovada automaticamente. Conta antiga só conhecida no Dashboard não é vinculada automaticamente. A proteção depende de essas rotinas locais estarem publicadas; isso não foi verificado remotamente.

## Próximo passo

Receber o resultado da consulta de estado e o erro da requisição `/v2/core/account_links` no Dashboard Stripe (type, code, param, message sem dados pessoais/segredos, request_id). Não é necessário gerar nova account para coletar os logs de uma tentativa já feita. O novo logger local só terá efeito em produção após deploy autorizado; nenhum deploy foi feito.

## Validação local

- 121 testes Stripe passaram em oito arquivos, incluindo 23 cenários novos de onboarding.
- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm run build`: passou, com avisos de chunk `auth` vazio e chunks acima de 500 kB.
- `git diff --check`: passou.

Nenhum teste chamou a Stripe ou Supabase remotamente. O endpoint foi exercitado com transportes simulados; as suítes de banco usam PostgreSQL local via PGlite. Isso verifica o comportamento do código, não confirma sucesso de onboarding em produção.
