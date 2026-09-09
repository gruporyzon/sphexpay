> Atualização: a persistência e o fluxo atuais são separados por modo. Consulte [Stripe Connect Test/Live](stripe-connect-test-live.md), incluindo a migration `20260909010000_stripe_connect_modes.sql`. Descrições de vínculo único/ausência de criação no onboarding abaixo são históricas.

# Integração Stripe — auditoria e operação

## Continuação auditada em 08/09/2026

Esta seção descreve o estado atual e prevalece sobre os relatos históricos abaixo. Todas as alterações encontradas no início foram preservadas. Nenhum push, deploy, chamada autenticada à Stripe/Supabase ou migration remota foi executado.

### O que já funcionava localmente

Criação de Account v2 Express brasileira com merchant e recipient; reserva persistida e idempotência; vínculo único por usuário; onboarding sobre a conta persistida; refresh/return autenticados; leitura v1 de charges_enabled, payouts_enabled, details_submitted e capabilities; Checkout hospedado com direct charge; assinatura oficial de webhook, ledger e recibo atômicos; RLS e RPCs restritas ao servidor.

O endpoint de onboarding **não cria contas**: consulta o vínculo e retorna `CONNECT_ACCOUNT_REQUIRED` (409) se ele não existir. A criação ocorre em `/api/stripe/connect/account`, chamada antes pelo Financeiro. A leitura v1 de contas v2 e os eventos snapshot v1 continuam suportados pela [documentação oficial Stripe](https://docs.stripe.com/connect/accounts-v2/migrate-integration). Não há evidência local que justifique trocar esse contrato.

### Problemas corrigidos nesta continuação

1. `apply_stripe_payment` podia manter `declined` quando recebia um estado atual `approved` acompanhado do timestamp de um evento anterior. Um teste no PostgreSQL reproduziu a falha. A nova migration permite essa aprovação; mantém proteção de sucesso/reembolso, lock, recibos e outbox.
2. O webhook comparava metadata, valor, taxa e vendedor, mas não vinculava o PaymentIntent à sessão Checkout persistida. Agora consulta essa sessão na mesma conta Connect e verifica ID, modo, client_reference_id e payment_intent. Metadata copiada não basta para importar uma venda.
3. Uma mudança de `APP_URL` após timeout alterava os parâmetros enviados com a mesma chave idempotente. `checkout_origin` agora é reservado junto ao pedido e reutilizado, assim como preço, taxa e comprador. A [Stripe exige parâmetros iguais nos retries idempotentes](https://docs.stripe.com/api/idempotent_requests).
4. JSON malformado gerava erro genérico 502 e o GET aceitava sequências de 36 hífens como UUID. Agora ambos retornam 400 antes de consultar tabelas. O status autenticado usa `Cache-Control: no-store`.

Se o webhook chegar antes de o `session_id` ser persistido, retorna 500 sem consumir o evento; reenviar após a persistência. Se a gravação da sessão falhar, repetir a mesma tentativa dentro da janela de 23 horas recupera a mesma sessão. Após essa janela, reconciliar com os logs Stripe, sem apagar pedidos ou reservas.

### Migration e compatibilidade

Aplicar no Supabase de **testes**, usando o histórico de migrations e uma transação por migration, nesta ordem (depois do baseline, Products V2 e Checkout Studio):

1. `20260903110000_stripe_connect_foundation.sql`, se ainda não aplicada.
2. `20260904120000_stripe_payments.sql`, se ainda não aplicada.
3. `20260908235100_fix_stripe_account_id_format.sql`, conferindo antes os counts e o catálogo nos scripts `docs/sql/`. A documentação anterior relata correção remota; esta sessão não a reconfirmou.
4. **Nova:** `20260909001000_stripe_checkout_integrity.sql`. Adiciona `checkout_origin` e substitui somente a função financeira pela versão corrigida, preservando seus privilégios.

Aplicar a nova migration antes de executar este backend. Nenhuma migration anterior foi editada. Pedidos anteriores conservam seus dados: os que já têm sessão continuam recuperáveis; os que não têm sessão nem origem exigem reconciliação. Não preencher a origem antiga com a APP_URL atual por suposição. A migration não reprocessa recibos antigos nem corrige automaticamente vendas históricas eventualmente afetadas pela ordenação; essas exigem conciliação com o PaymentIntent e a sessão oficiais.

### Arquivos modificados por esta continuação

- `api/payments/webhook.js`, `api/stripe/connect/status.js`.
- `server/stripe/connect.js`, `server/stripe/payments.js`, `server/stripe/webhook.js`.
- `src/test/stripePayments.test.ts`, `src/test/stripePaymentsDatabase.test.ts`, `src/test/stripeRouting.test.ts`.
- `supabase/migrations/20260909001000_stripe_checkout_integrity.sql` (novo).
- Este documento, `docs/stripe-connect-onboarding-diagnosis.md` e `docs/stripe-connect-persistence-audit.md`.

Os demais arquivos modificados/novos encontrados no Git são trabalho anterior preservado, inclusive o frontend, diagnostics, migrations e testes de Connect. O teste de backend citado como `src/services/stripeConnectBackend.test.ts` no pedido está de fato em `src/test/stripeConnectBackend.test.ts`.

### Validação desta continuação

- Baseline antes das correções: 131 testes Stripe passaram em 8 arquivos.
- Regressão de aprovação fora de ordem: falhou como esperado antes da correção (`declined` em vez de `approved`) no PostgreSQL local.
- Após correções de pagamento/migration: 41 testes passaram em 2 arquivos.
- Validação final: **162 testes passaram em 12 arquivos**, incluindo 139 testes Stripe e regressões de Checkout Studio, Products V2 e processador de pagamentos legado.
- `npm run typecheck`, `npm run lint`, `npm run build` e `git diff --check`: passaram. Build manteve avisos de chunk `auth` vazio e chunks acima de 500 kB; o ambiente local não tem configuração Supabase de build.
- Testes Stripe usam SDK/transporte simulado e PGlite/PostgreSQL local. Nenhum pagamento externo foi executado e a infraestrutura remota não foi validada.

### Configuração ainda necessária e homologação

As variáveis listadas abaixo não estavam preenchidas no processo nem em `.env.local` durante esta auditoria; valores de credenciais não foram impressos. A configuração remota é desconhecida.

- Servidor: `STRIPE_SECRET_KEY` de teste, `STRIPE_WEBHOOK_SECRET` da destination/CLI correta, `APP_URL`, `STRIPE_PLATFORM_FEE_BPS` explícito (inclusive se zero), `STRIPE_LIVE_PAYMENTS_ENABLED=false`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` ou `VITE_SUPABASE_URL`.
- Build/frontend: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Nunca usar prefixo VITE para secrets.
- Stripe Dashboard: plataforma Test/Sandbox com Connect Accounts v2 habilitado; revisar Express/BR, merchant/card_payments e recipient/transfers. Destination **Connected accounts / Snapshot** em `/api/stripe/webhook`, com os sete eventos listados abaixo. Conferir erros de onboarding pelo request_id sanitizado, sem recriar a conta para tentar corrigir um link.
- Supabase: banco de testes separado do live, migrations completas, privilégios/RLS e vínculo do usuário conferidos pelos scripts somente leitura existentes.
- Vercel: ainda não foi publicado nada. Para futura homologação autorizada, configurar as variáveis no ambiente de testes/Preview e verificar os dois rewrites. Localmente usar runtime que sirva `api/`, como `vercel dev`; Vite sozinho não serve as funções.

Executar a sequência de Test Mode abaixo e acrescentar: timeout seguido de retry com mesma chave; webhook antes da gravação da sessão e posterior reenvio; tentativa com metadata de outro pedido; aprovação recebida fora de ordem. Conferir uma sessão por tentativa, uma venda por PaymentIntent, conta Connect correta e recibos sem duplicação. Os flags do Connect precisam vir de consulta Stripe; redirect não comprova aprovação.

A homologação real de onboarding, cobranças, assinatura no runtime Vercel e persistência remota permanece pendente dessa configuração. Não se afirma funcionamento de pagamentos reais. Os limites de cartão à vista, saldo demonstrativo, reembolso parcial na UI e outbox descritos abaixo permanecem.

---

Estado local de 04/09/2026. Nenhum deploy, alteração de variáveis remotas, migration remota ou cobrança foi executado. A validação usa mocks da API oficial e PostgreSQL em memória (PGlite). Não equivale à homologação ponta a ponta da conta Stripe/Supabase/Vercel.

## Auditoria inicial

`git status --short` mostrou somente alterações anteriores em `server/stripe/connect.js` e `src/test/stripeConnectBackend.test.ts`. Foram preservadas a correção do tipo Express na leitura v1 e a coleta de requisitos merchant + recipient no onboarding v2.

Foram analisados os serviços Stripe, os três handlers Connect, webhook e health legados de pagamentos, processador financeiro, tabelas/migrations do catálogo, Connect, checkout e ledger, Financeiro, serviços de frontend, rotas, testes e nomes de variáveis locais. Não houve inspeção do banco ou configuração remota.

Endpoints existentes antes desta etapa:

| Endpoint | Implementação encontrada e preservada |
| --- | --- |
| `POST /api/stripe/connect/account` | Autentica via Supabase, recupera vínculo ou cria Account v2 Express, persiste ID. |
| `POST /api/stripe/connect/onboarding` | Autentica, reutiliza conta, gera Account Link v2 para merchant e recipient. |
| `GET /api/stripe/connect/status` | Autentica, busca somente vínculo do usuário, consulta Accounts v1 e sincroniza Supabase preservando Express. |
| `POST /api/payments/webhook` | Webhook legado HMAC próprio. Não era webhook Stripe. Permanece para outros provedores; `provider=stripe` agora exige rota e assinatura oficiais. |
| `GET /api/payments/health` | Diagnóstico legado restrito a administrador. Seu campo `webhookConfigured` continua referindo-se ao webhook legado, não ao Stripe. |

Os três endpoints Connect tinham cobertura local; não se comprovou disponibilidade remota nesta sessão. A UI de Financeiro já tratava retorno e renovação de links com autenticação. Abandonar e retornar conserva o vínculo; return_url não significa que o onboarding terminou. O GET de status e `account.updated` verificam novamente a Stripe.

O checkout legado em `Operations.tsx` é demonstrativo. Checkout Studio já possuía tabelas, ofertas e versões publicadas, mas não criava cobranças. As tabelas `payment_transactions`, `payment_transaction_events` e `financial_event_outbox` já existiam e foram reutilizadas.

## Modelo escolhido

Direct charges com Stripe Checkout hospedado. Cada oferta tem um vendedor e uma conta Connect; o vendedor é o merchant da venda. A SPHEX PAY oferece o software e pode receber `application_fee_amount`. Não há um fluxo implementado de múltiplos recebedores por cobrança que justifique separate charges and transfers. Destination charges mudariam a localização da cobrança para a plataforma sem uma necessidade identificada no código.

A criação Connect existente atribui à plataforma as responsabilidades `fees_collector=application` e `losses_collector=application`; isso foi preservado. Direct charges não eliminam essas responsabilidades. Validar esse modelo comercial antes de habilitar produção.

Referências oficiais: [direct charges](https://docs.stripe.com/connect/direct-charges), [comparação de cobranças](https://docs.stripe.com/connect/charges).

## Fluxo implementado

Usuário autenticado → Financeiro → criar/recuperar conta → onboarding Stripe → `/app/financeiro/stripe/return` → status atualizado → produto/Pagamentos habilita cartão → oferta única à vista + checkout publicado + produto ativo → `/pay/:checkoutId` → sessão Checkout criada no backend → Stripe coleta cartão → webhook oficial → ledger e status persistidos.

`/app/financeiro/stripe/refresh` gera um novo link autenticado para a mesma conta. Links expiram e não são persistidos/reutilizados como credenciais.

| Endpoint/rota | Contrato |
| --- | --- |
| `POST /api/stripe/connect/status` | Privado. `{productId, enabled}`; verifica ownership e capabilities reais antes de habilitar cartão. Desabilitar não depende de a Stripe estar disponível. |
| `GET /api/stripe/checkout?checkoutId=UUID` | Público. Retorna nome, preço e moeda de oferta ativa de um checkout publicado elegível. |
| `POST /api/stripe/checkout` | Público para comprador. Aceita apenas `{checkoutId, requestKey, buyer: {name, email}}`. Não aceita preço, moeda, seller/merchant, conta Stripe ou metadata do cliente. |
| `POST /api/stripe/webhook` | Público, autenticado pela assinatura Stripe. `STRIPE_WEBHOOK_SECRET` obrigatório. |
| `/pay/:checkoutId` | Página pública que encaminha o comprador ao Checkout hospedado; cartão nunca passa pelo servidor ou frontend SPHEX PAY. |

As duas novas URLs de API usam rewrites para o handler de pagamentos existente, preservando as 12 funções Vercel. A seleção de rota suporta URL original e `stripeAction` após rewrite. O webhook lê bytes do stream sem acessar o getter JSON do body; o comportamento de restauração do stream do runtime consta no [código oficial da Vercel](https://github.com/vercel/vercel/blob/main/packages/node/src/serverless-functions/helpers.ts).

## Garantias e persistência

- Reserva de criação Connect no banco antes da chamada externa. Parâmetros imutáveis, chave determinística por usuário, unicidade de usuário/conta e trigger impedindo substituição do vínculo. Tentativas incompletas além de 23 horas exigem reconciliação em vez de criar outra conta após expiração da idempotência Stripe.
- Conta de cobrança derivada do seller do produto e do vínculo persistido. Metadata da conta, quando presente, deve corresponder ao dono; ID retornado deve corresponder ao vínculo.
- Antes de cobrar, sincroniza capabilities, `charges_enabled`, `payouts_enabled` e requirements da Stripe. Cartão exige `card_payments=active`; método precisa estar habilitado para o produto.
- Preço em centavos inteiros, moeda BRL/USD/EUR, produto/oferta/versão/vendedor e publicação são verificados no servidor. Snapshot do pedido preserva valor, taxa, produto e comprador.
- Pedido tem `request_key` único, chave Stripe por pedido e recuperação da sessão existente. Repetições não criam nova sessão; tentativas antigas sem resultado persistido exigem reconciliação. Uma nova compra é uma ação explícita.
- Webhook valida assinatura oficial e tolerância temporal antes do banco. Payload inválido recebe 400; falhas de processamento recebem 500 para permitir retry. Secrets e payloads pessoais não são logados. Chamada Stripe tem timeout de cinco segundos sem retries internos.
- Eventos de pagamento buscam o PaymentIntent atual na conta conectada, verificam metadata, conta, valor, moeda e taxa contra o pedido. Venda é identificada por conta + PaymentIntent. Eventos não pertencentes à SPHEX PAY são ignorados.
- Persistência financeira e recibo de webhook são atômicos em `apply_stripe_payment`, com lock do pedido. Eventos duplicados não reaplicam transações. Eventos atrasados de falha não revertem aprovação; reembolso total é terminal. Falhas não consomem o ID do evento.
- Reembolso parcial preserva `refunded_cents` no pedido e na metadata do ledger; não marca uma venda inteira como reembolsada.
- Reutiliza ledger, histórico e outbox. Webhook não espera envio de push. Outbox fica pendente para consumo; esta etapa não adiciona um worker de entrega de notificações.
- Tabelas auxiliares possuem RLS e acesso somente service_role; RPCs financeiras não são executáveis por anon/authenticated. Nenhuma credencial Stripe é incluída no bundle do frontend.

Migration aditiva: `supabase/migrations/20260904120000_stripe_payments.sql`. Requer as migrations existentes de Connect e Checkout Studio. Adiciona `stripe_capabilities`, reservas, snapshots de pedido e recibos de webhook; reutiliza valores, timestamps e identidade de vendedor no ledger existente.

## Taxa e variáveis

Nenhuma taxa de produção foi encontrada. `STRIPE_PLATFORM_FEE_BPS` é a única regra central: inteiro entre 0 e 10000 pontos-base; taxa em centavos calculada com arredondamento para baixo. Ausência ou valor inválido bloqueia cobrança. Zero também exige configuração explícita; não foi escolhido percentual nesta sessão. Snapshot guarda valor e regra aplicada, sem alterar pedidos anteriores quando a configuração muda.

Nomes de variáveis necessárias, ausentes no ambiente local auditado (isso não informa seu estado na Vercel):

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `APP_URL`
- `STRIPE_PLATFORM_FEE_BPS`
- `STRIPE_LIVE_PAYMENTS_ENABLED`
- `SUPABASE_URL` ou `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Novas configurações/documentação no `.env.example`: variáveis Stripe, URL e regra de taxa. As secrets Stripe e Supabase service_role são exclusivamente do servidor; nunca prefixá-las com `VITE_`. `STRIPE_LIVE_PAYMENTS_ENABLED` permanece desabilitado por padrão. A chave test permite testar após definir uma taxa explícita; uma chave live exige habilitação adicional deliberada. Não misturar vínculos de contas test e live no mesmo banco: a estrutura existente tem um vínculo por usuário, não um vínculo por modo.

## Configuração manual e Test Mode

1. Revisar a migration e aplicá-la manualmente em um projeto Supabase de testes com as migrations anteriores. Não aplicar apenas a nova migration sobre um banco vazio. Conferir tabelas, privilégios e RPCs. O schema remoto não foi consultado.
2. No Dashboard Stripe, selecionar Test Mode/Sandbox da plataforma, habilitar Connect e conferir o modelo Express/Accounts v2, país BR, merchant com cartão e recipient com transfers. Usar credenciais desse mesmo ambiente.
3. Configurar as variáveis acima em um ambiente local ou de testes. Definir a regra de taxa aprovada para testes; não há percentual presumido. Manter produção desabilitada. O projeto atual necessita de `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` durante build para autenticação do frontend.
4. Executar a aplicação com um runtime que sirva também `api/` e os rewrites, por exemplo `npx vercel dev`. `npm run dev` sozinho só executa Vite. Definir `APP_URL` como a origem utilizada pelo navegador; HTTP é aceito apenas em localhost. Se o runtime não aplicar rewrites localmente, usar a rota física com `?stripeAction=webhook` no encaminhamento de testes.
5. Para teste local, usar Stripe CLI autenticada na plataforma test: `stripe listen --forward-connect-to localhost:3000/api/stripe/webhook` (ajustar porta). Configurar `STRIPE_WEBHOOK_SECRET` com o signing secret dessa sessão CLI e reiniciar o backend. Não publicar nem registrar esse valor em logs próprios.
6. Para um ambiente HTTPS já disponibilizado manualmente, configurar em Workbench/Webhooks uma destination de **Connected accounts**, payload **Snapshot**, para `/api/stripe/webhook`, com os eventos abaixo. Usar o signing secret dessa destination, que é diferente do secret da CLI. Este código recebe snapshots v1, inclusive para contas criadas via v2; não configurar Thin neste endpoint. A Stripe documenta que contas v2 também emitem eventos v1 em [migração Accounts v2](https://docs.stripe.com/connect/accounts-v2/migrate-integration).
7. Entrar na SPHEX PAY, abrir Financeiro, concluir onboarding usando dados de teste aceitos pela Stripe e aguardar capabilities ativas. Conferir que abandonar, renovar o link e retornar mantém o mesmo ID de conta.
8. Criar/configurar produto e oferta ativa de pagamento único com uma parcela e moeda compatível. Na aba Pagamentos, habilitar cartão. No Checkout Studio, publicar uma versão com os componentes obrigatórios; ativar o produto. Usar “Copiar link de pagamento” no menu do checkout publicado.
9. Abrir o link `/pay/:checkoutId`, preencher comprador e pagar no Stripe Checkout. Usar `4242 4242 4242 4242` para sucesso e `4000 0000 0000 0002` para recusa, validade futura e CVC de teste. Não usar cartão real. Referência: [cartões oficiais de teste](https://docs.stripe.com/testing).
10. Conferir no Stripe o PaymentIntent dentro da conta conectada e a taxa da plataforma. No Supabase, conferir pedido, recibos de webhook, `payment_transactions` e histórico. Três eventos correlacionados devem produzir uma venda, não três.
11. Reenviar um evento pela Stripe e verificar resposta 200 com duplicata sem nova venda. Enviar payload sem assinatura deve retornar 400 e não gravar dados. Simular indisponibilidade do banco deve provocar 500 e permitir reenvio posterior.
12. Testar recusa seguida de aprovação, cancelamento/retomada, reembolso parcial e total pelo Dashboard test, eventos atrasados e tentativa de adulterar valor/conta no POST. Consultar status depois do onboarding sem inferir aprovação só pelo redirect.

Eventos iniciais da destination:

- `account.updated`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.succeeded`
- `charge.failed`
- `charge.refunded`
- `checkout.session.completed`

Referências: [webhooks Connect](https://docs.stripe.com/connect/webhooks), [assinatura e payload bruto](https://docs.stripe.com/webhooks), [idempotência](https://docs.stripe.com/api/idempotent_requests).

## Limites explícitos

A implementação inicial aceita cartão, pagamento único, uma parcela e um vendedor. Assinaturas, Pix, boleto, cupons, order bumps, splits e fulfillment automático não são executados por esta rota. O Studio conserva seus drafts e previews; a página de pagamento usa a oferta da versão publicada e encaminha ao Checkout hospedado, sem reproduzir todos os blocos visuais do Studio.

O Financeiro legado ainda tem saldo/extrato demonstrativos em `useDemoStore`; eles não são saldos Stripe nem constituem conciliação bancária. Esta etapa integra vendas ao ledger canônico usado pelos serviços de vendas, preservando esses módulos existentes. Reembolsos parciais estão persistidos, mas a apresentação agregada antiga não desconta automaticamente a parcela reembolsada. O outbox não é prova de push entregue. Nenhuma dessas telas deve ser usada como comprovação de saldo sacável Stripe.

Antes de produção: homologar ponta a ponta, confirmar taxa e responsabilidades comerciais, validar a destination na infraestrutura escolhida e tratar separadamente saldo/saques reais, apresentação de reembolso parcial e entrega do outbox se necessários à operação. Não habilitar live apenas trocando a chave.

## Recuperação de tentativas antigas

Para `CONNECT_RECONCILIATION_REQUIRED`, um operador deve localizar a tentativa no banco e a conta correspondente na Stripe usando metadata e logs de requisições da própria Stripe. Se a conta existe, confirmar ownership e persistir o vínculo ausente; nunca substituir automaticamente um vínculo existente ou apagar a reserva para tentar de novo. Tentativas anteriores à introdução da reserva também devem ser verificadas se houver suspeita de conta órfã.

Para `PAYMENT_RECONCILIATION_REQUIRED`, localizar a sessão usando o ID interno do pedido em metadata/client_reference_id e os logs Stripe. Persistir a sessão comprovada e reenviar seus webhooks. Não apagar o pedido nem gerar outra cobrança para contornar um resultado desconhecido. Essas ações administrativas não foram executadas nesta sessão.

## Arquivos alterados/adicionados

- Backend: `server/stripe/client.js`, `server/stripe/connect.js`, `server/stripe/payments.js`, `server/stripe/webhook.js`, `api/payments/webhook.js`, `api/stripe/connect/status.js`.
- Frontend relacionado: `src/App.tsx`, `src/components/finance/StripeConnectCard.tsx`, `src/services/stripeConnectService.ts`, `src/features/products/CheckoutStudio.tsx`, `src/features/products/ProductsV2.tsx`, `src/features/products/StripePaymentPage.tsx`.
- Banco: `supabase/migrations/20260904120000_stripe_payments.sql`.
- Testes: `src/test/stripeConnectBackend.test.ts`, `src/test/stripePayments.test.ts`, `src/test/stripePaymentsDatabase.test.ts`, `src/test/stripeRouting.test.ts`.
- Configuração/documentação: `.env.example`, `vercel.json`, `package.json`, `package-lock.json`, `docs/stripe-integration.md`.

PGlite foi adicionado somente como dependência de desenvolvimento para executar os testes SQL localmente. Nenhuma migration existente foi editada. As alterações prévias do usuário nos dois arquivos Connect foram mantidas.

## Validação local

105 testes relevantes passaram em nove arquivos, cobrindo Connect, assinatura real gerada pelo SDK Stripe, rotas, ownership, preço adulterado, pagamento, recusa, reembolso, idempotência e execução das novas funções SQL com DDL do ledger existente. `npm run typecheck`, `npm run lint`, `npm run build` e `git diff --check` passaram. O build mantém avisos de tamanho de chunks e chunk `auth` vazio no ambiente local sem configuração Supabase. Nenhum padrão de secret Stripe foi encontrado no bundle. Não foram usados tokens Stripe ou Supabase reais nos testes.
