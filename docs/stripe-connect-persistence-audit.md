> Atualização: a persistência e o fluxo atuais são separados por modo. Consulte [Stripe Connect Test/Live](stripe-connect-test-live.md), incluindo a migration `20260909010000_stripe_connect_modes.sql`. Descrições de vínculo único/ausência de criação no onboarding abaixo são históricas.

# Auditoria local de persistência Stripe Connect — 2026-09-08

> Atualização da continuação de 08/09/2026: o endpoint de onboarding atual apenas consulta o vínculo persistido; sem vínculo retorna 409 e não cria conta. A criação é exclusiva do endpoint `/api/stripe/connect/account`. Os trechos abaixo que descrevem `ensureConnectedAccount` dentro do onboarding são históricos. Consulte o estado atual, a nova migration de integridade de pagamentos e a homologação pendente em [stripe-integration.md](stripe-integration.md). Nenhum estado remoto foi reconfirmado nesta continuação.

## Atualização após inspeção remota fornecida pelo usuário

Causa confirmada no Supabase remoto: `stripe_connected_accounts_account_id_format` contém uma quebra de linha e três espaços antes de `$`. A constraint de tipo aceita `express` e a de onboarding aceita `pending`; não precisam de alteração. A análise inicial abaixo fica preservada como histórico anterior à confirmação.

A criação local está em `20260903110000_stripe_connect_foundation.sql:17`, introduzida no commit `3e6ea9519e4315f5e43b2f4fb971aa04e079c0aa`, já com a regex correta. Nenhuma migration ou versão encontrada no histórico Git disponível introduz o newline. A origem da divergência remota não foi determinada.

Correção proposta: `supabase/migrations/20260908235100_fix_stripe_account_id_format.sql`. Um único `ALTER TABLE` substitui somente o CHECK de formato e valida os registros existentes atomicamente. Não altera dados, tipos, status, outras constraints ou código Stripe. Reexecução mantém a mesma definição. Em caso de dados inválidos, falha preservando o estado anterior. A validação pode bloquear escritas enquanto executa.

Antes da aplicação manual, executar somente `docs/sql/stripe-connect-account-id-counts.sql`. Contagens remotas ainda não obtidas. Se `invalidos` for diferente de zero, interromper a aplicação e analisar os registros sem corrigi-los automaticamente.

A lógica de recuperação permanece inalterada: vínculo local é reutilizado; reserva recente repete a chave estável e os parâmetros originais; reserva com mais de 23 horas bloqueia a criação e exige reconciliação. O ID conhecido apenas no Dashboard não é vinculado automaticamente por este fluxo. Para uma tentativa antiga, será preciso confirmar ownership e reconciliar a conta existente antes de retomar; não reiniciar a reserva nem trocar a chave. A versão atualmente publicada dessas proteções não foi verificada remotamente.

Validação da correção: 98 testes Stripe passaram em sete arquivos, incluindo `stripeConnectAccountIdMigration.test.ts`; typecheck, lint e build passaram. O build manteve avisos de chunk vazio e tamanho de chunks. Os testes reproduzem o newline real em PostgreSQL, verificam aceitação do ID informado, rejeição de IDs inválidos, preservação das demais constraints e dados, reexecução da migration e atomicidade quando existem dados incompatíveis.

Nenhuma operação remota, criação Stripe, commit, push ou deploy foi executado para esta correção.

---

Escopo: `/Users/ronaldyrodriguez/Desktop/SphexPay`. Já havia alterações locais em backend, testes, pagamentos e migrations; foram preservadas. Nenhuma consulta remota, criação Stripe, migration remota, commit, push ou deploy foi executado nesta auditoria.

## Conclusão verificável

O resumo dos logs informa SQLSTATE 23514, mas não fornece o nome da constraint nem o payload completo. Não é possível identificar honestamente a constraint de produção apenas com esse código. Ele identifica a classe de erro, não a coluna.

No checkout atual, uma Account v2 sem `type`, com `configuration.merchant` e `configuration.recipient`, gera `stripe_account_type: 'express'`. Esse valor é aceito pelo schema local. `merchant` e `recipient` não são enviados para essa coluna. A documentação Stripe e o SDK instalado distinguem configurações de `dashboard` e não declaram `type` na raiz de Account v2.

Fonte oficial: https://docs.stripe.com/api/v2/core/accounts

## Schema encontrado

- `supabase/migrations/20260903110000_stripe_connect_foundation.sql`: cria a tabela, os três CHECKs, unicidade de usuário/conta, FK para `auth.users`, RLS e permissões.
- `supabase/migrations/20260904120000_stripe_payments.sql`: adiciona `stripe_capabilities jsonb NOT NULL DEFAULT '{}'` e trigger de identidade imutável. Cria também a reserva de parâmetros em `stripe_account_requests`. Esta migration já estava não rastreada no checkout; sua aplicação em produção não foi confirmada.
- Não há outras migrations locais referenciando a tabela. Não há enum PostgreSQL para suas colunas: tipo e status são `text` com CHECK.

| Campo real no insert/upsert | Valor do backend | Regra local |
|---|---|---|
| `user_id` | `user.id` autenticado por `auth.getUser` | UUID, NOT NULL, FK `auth.users`, UNIQUE |
| `stripe_account_id` | `account.id` literal | text, NOT NULL, UNIQUE, `^acct_[A-Za-z0-9]+$` |
| `stripe_account_type` | `account.type || 'express'` | apenas `express` |
| `stripe_capabilities` | `account.capabilities || {}` | jsonb, NOT NULL, sem CHECK |
| `stripe_onboarding_status` | função `onboardingStatus(account)` | `pending`, `in_review`, `requirements_due`, `enabled` |
| `stripe_details_submitted` | `Boolean(account.details_submitted)` | boolean, NOT NULL |
| `stripe_charges_enabled` | `Boolean(account.charges_enabled)` | boolean, NOT NULL |
| `stripe_payouts_enabled` | `Boolean(account.payouts_enabled)` | boolean, NOT NULL |
| `stripe_requirements_currently_due` | `account.requirements?.currently_due || []` | text[], NOT NULL |
| `stripe_requirements_eventually_due` | `account.requirements?.eventually_due || []` | text[], NOT NULL |
| `updated_at` | data atual ISO | timestamptz, NOT NULL |
| `id`, `created_at` | omitidos | defaults do banco |

Não existem colunas literais `account_type`, `type`, `status`, `onboarding_status`, `charges_enabled`, `payouts_enabled`, `details_submitted`, `configuration`, `merchant` ou `recipient`. As configurações v2 não são persistidas separadamente pelo código atual. Isso merece avaliação de modelagem, mas não demonstra a causa do 23514.

CHECKs exatos definidos pelo schema local:

1. `stripe_connected_accounts_account_id_format`
2. `stripe_connected_accounts_stripe_account_type_check`
3. `stripe_connected_accounts_stripe_onboarding_status_check`

Comparação objetiva para uma resposta v2 sem `type`:

- VALOR ENVIADO PELO BACKEND: `express`.
- VALORES ACEITOS PELO BANCO LOCAL: `express`.
- CONSTRAINT DE TIPO: `stripe_connected_accounts_stripe_account_type_check`.
- CAUSA: não há incompatibilidade nesse caso. Se a resposta contiver `type: 'none'`, por exemplo, o backend enviará `none` e esse CHECK falhará. Essa hipótese foi isolada em teste, não confirmada nos logs reais.

Um ID que corresponde à regex não exige relaxamento da constraint de formato. O status calculado só retorna valores admitidos localmente. É necessário comparar as constraints efetivamente instaladas e a versão publicada antes de propor SQL corretivo.

## Fluxo e idempotência existentes

`api/stripe/connect/account.js` autentica, chama `ensureConnectedAccount` e retorna status. `api/stripe/connect/onboarding.js` autentica, aguarda `ensureConnectedAccount` e só então cria o link v2. Portanto a ordem persistência → confirmação via `select().single()` → link já existe. IDs enviados pelo cliente não são utilizados nesses endpoints.

`ensureConnectedAccount` busca por `user_id` antes de criar. Reutiliza o vínculo encontrado. Usa a chave estável `sphex-connect-` + SHA-256 do usuário. A RPC `reserve_stripe_account` conserva os parâmetros originais e recusa reservas com mais de 23 horas. Retry dentro dessa janela repete a mesma requisição idempotente. A trigger impede trocar a identidade de vínculo existente; a UNIQUE do ID impede vinculá-lo a dois usuários.

Limitações pendentes: a reserva armazena parâmetros, mas não o account ID retornado; uma falha local depende do retry idempotente e, depois da janela, de reconciliação. Não há recuperação automática por metadata nem confirmação de que as tentativas antigas utilizaram esta reserva. A aplicação remota da migration de reserva também não foi confirmada. Não se deve renovar a reserva ou alterar a chave para contornar o bloqueio, pois isso pode criar duplicatas.

A leitura de status via `stripe.accounts.retrieve` já existia; esta auditoria não introduziu nem ampliou uso de v1. A criação e o onboarding continuam v2. Os logs temporários de formato permanecem até confirmação da causa, conforme a etapa 6 solicitada. Os logs de persistência locais já permitem os nomes dos três CHECKs e ocultam o conteúdo livre de failing rows.

## Testes e próxima evidência

`src/test/stripeConnectPersistenceDatabase.test.ts` executa o DDL real do Connect em PGlite/PostgreSQL e o objeto produzido por `connectionRecord`. Confirma aceitação da resposta v2 sem `type`, identifica constraints no catálogo e diferencia falhas de tipo, status, formato e identidade entre usuários. Os testes existentes cobrem autenticação, reutilização, retry com chave estável, diagnóstico seguro e account link correto. Um mock de sucesso não é tratado como prova do schema real de produção.

Para concluir a correção, obter:

1. A mensagem exata `violates check constraint "..."`, sem failing row ou credenciais.
2. O valor de `type` da resposta de criação, ou confirmação de que está ausente.
3. Resultado das consultas somente leitura em `docs/sql/stripe-connect-inspect.sql`, executadas no banco do deployment que falhou, e revisão da versão publicada.

MIGRATION PROPOSTA: nenhuma até confirmar a divergência. Não há SQL ALTER especulativo.
DADOS EXISTENTES: preservados, sem alteração remota.
RISCO DAS ALTERAÇÕES DESTA AUDITORIA: baixo; apenas testes e documentação.
STRIPE ACCOUNT EXISTENTE REUTILIZADA: não executado contra Stripe; reutilização local coberta por testes.

A correção da causa de produção, a eventual migration incremental e a recuperação durável da conta permanecem pendentes dessa evidência. Não aplicar migration, fazer commit, push, deploy ou alterar Stripe Dashboard sem autorização.

## Resultado das validações locais

- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm run build`: passou; avisos de chunk `auth` vazio e chunks acima de 500 kB.
- Seis arquivos de testes Stripe, incluindo a nova suíte PostgreSQL: 95 testes passaram.
- `git diff --check`: passou.

Comandos executados com `.runtime/bin` do próprio projeto adicionado ao PATH. Nenhuma instalação foi necessária.
