# Diagnóstico do GET /api/stripe/connect/status após onboarding

## Evidência e limites

A sequência de Production informada foi Auth/Supabase GET, conexão/Supabase GET, Stripe GET `/v1/accounts/acct_…`, Supabase PATCH, HTTP 503 com “Não foi possível atualizar o status da sua conta de pagamentos.”

No código inspecionado, o PATCH só é alcançado depois que `stripe.accounts.retrieve` resolve e as verificações de modo, proprietário, ID e conta excluída passam. Portanto, supondo que esse código corresponda ao deployment observado, o retrieve estava funcionando. A mensagem informada é produzida exclusivamente quando o resultado do UPDATE contém `error` ou não contém `data`. A rejeição do PATCH ou a ausência da linha retornada está localizada; seu motivo PostgreSQL/PostgREST exato não está confirmado, pois os logs fornecidos não contêm status/código/mensagem do Supabase.

Não foi encontrada coluna com nome incorreto. O código anterior já preservava `stripe_account_type` local, evitando gravar `none` devolvido pela visão v1 de Accounts v2. Não se pode atribuir o incidente a esse CHECK sem o erro remoto. Também não é possível conhecer constraints, triggers, grants ou estado do schema cache de Production apenas pela lista de nomes de colunas.

## Comparação integral do PATCH

| Campo enviado | Origem | Existe no schema informado |
| --- | --- | --- |
| `stripe_mode` | Modo da chave do backend | Sim |
| `user_id` | Usuário autenticado | Sim |
| `stripe_account_id` | `account.id`, validado contra vínculo | Sim |
| `stripe_account_type` | Tipo já persistido no vínculo | Sim |
| `stripe_capabilities` | `account.capabilities` ou `{}` | Sim |
| `stripe_onboarding_status` | Derivado dos flags/requisitos | Sim |
| `stripe_details_submitted` | Boolean de `account.details_submitted` | Sim |
| `stripe_charges_enabled` | Boolean de `account.charges_enabled` | Sim |
| `stripe_payouts_enabled` | Boolean de `account.payouts_enabled` | Sim |
| `stripe_requirements_currently_due` | `account.requirements.currently_due` ou `[]` | Sim |
| `stripe_requirements_eventually_due` | `account.requirements.eventually_due` ou `[]` | Sim |
| `updated_at` | Timestamp do servidor | Sim |

`id` e `created_at` não são gravados pelo PATCH. Os nomes sem prefixo existem somente no objeto recebido da Stripe; não são colunas enviadas ao banco.

## Correções locais

- UPDATE exige `user_id`, `stripe_mode` e `stripe_account_id`. Antes havia filtros de usuário e conta, mas faltava o filtro explícito de modo. A falta desse filtro não prova a causa do 503.
- Erro ou ausência de linha no PATCH gera `CONNECT_STORAGE_ERROR`, HTTP 500. Falha de transporte da persistência recebe a mesma classificação.
- Logs do PATCH incluem `stage=persist_status`, `mode`, `operation=PATCH`, status HTTP do Supabase quando disponível, código técnico e mensagem permitida por lista fechada. Texto arbitrário, details e hints sensíveis são redigidos. Falha no GET da conexão também recebe contexto de etapa/operação na rota de status.
- GET status traduz configuração interna/persistência para 500 e falha temporária de autenticação para 502. Erros temporários reconhecidos da Stripe (conexão, rate limit, API/5xx) usam 503; configuração/permissão/requisição inválida usam 500. Outros erros de retrieve mantêm 502. O fluxo POST de configuração de produtos não foi remodelado.
- O contrato de sucesso continua independente das colunas físicas: `mode`, `connected`, `onboardingComplete`, `chargesEnabled`, `payoutsEnabled`, `detailsSubmitted`, além dos campos já existentes. `onboardingComplete` reflete `details_submitted`; não promete habilitação de cobranças ou repasses.

## Validação e próximo diagnóstico

O novo teste usa o cliente Supabase real para construir HTTP GET/PATCH, intercepta fetch localmente e executa o payload e os filtros em PostgreSQL PGlite com a migration de modos existente. Compara todas as colunas com o schema informado, verifica flags, requisitos e capabilities, e preserva integralmente legacy/live/outro usuário. Isso valida SQL e serialização HTTP locais; não reproduz a infraestrutura PostgREST remota nem confirma seus grants/cache/triggers.

Nenhuma migration nova é necessária para as alterações de código e o schema informado. Nenhuma migration foi executada remotamente. Nenhuma conta foi criada, apagada ou classificada; nenhuma variável de ambiente do projeto foi alterada.

Após publicação autorizada, um PATCH aceito retorna 200 com flags atualizados, reutilizando a conta TEST. Se a rejeição remota persistir, haverá 500 de persistência e diagnóstico sanitizado. Esse código/status/mensagem será necessário para fechar a causa raiz específica; não há evidência para prometer que apenas estas alterações eliminam a rejeição atual.

## Resultados desta rodada

- `npm test -- src/test/stripe`: 242 testes passaram em 13 arquivos, incluindo 13 casos novos de status.
- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm run build`: passou; avisos não bloqueantes de chunk `auth` vazio e chunks maiores que 500 kB.
- `git diff --check`: passou.

Execução com Node 22.16.0 temporário em `/tmp`, sem alteração de dependências. Sem commit, push, deploy ou operações remotas de banco/Stripe.
