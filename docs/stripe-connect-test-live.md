# Stripe Connect: separação Test / Live

## Diagnóstico e decisão

Antes desta correção, `20260903110000_stripe_connect_foundation.sql` criava `stripe_connected_accounts` com `UNIQUE(user_id)` e um único `stripe_account_id NOT NULL UNIQUE`. `20260904120000_stripe_payments.sql` acrescentava capabilities, a proteção contra troca de ID, pedidos com FK para esse ID e reservas de criação indexadas somente pelo usuário. A migration de formato de ID não registra ambiente. `findConnection` filtrava somente usuário; status, onboarding e checkout reutilizavam o resultado com a chave atual.

Isso confirma no código a possibilidade de consulta cruzada relatada após trocar a chave Live por Test. Não houve consulta remota ao Supabase/Stripe/Vercel nesta correção. O modo da conta específica e a origem exata do HTTP 503 não foram confirmados remotamente: o status local converte falha de retrieve Stripe em 502, enquanto erros de persistência podem produzir 503. O prefixo `acct_` não comprova ambiente. A documentação e migrations existentes não oferecem evidência suficiente para classificar o ID legado.

Foi escolhida a alternativa equivalente **uma linha por usuário e modo**, em vez de duas colunas de ID no mesmo registro. Ela também separa flags, requisitos, capabilities, timestamps e reservas, preservando o FK dos pedidos para `stripe_account_id`. Duas colunas exigiriam alterar esse FK e duplicar todos os campos de status, não apenas o ID.

| Campo / chave | Resultado |
| --- | --- |
| `stripe_connected_accounts.stripe_mode` | `legacy`, `test` ou `live`; linhas anteriores recebem `legacy` |
| `(user_id, stripe_mode)` | Único: uma conta para cada modo por usuário |
| `stripe_account_id` | Preservado, NOT NULL e globalmente UNIQUE; nenhum ID é apagado/copied para Test |
| Demais campos de conexão | Independentes por linha/modo; os valores antigos não são alterados |
| `stripe_account_requests` | PK `(user_id, stripe_mode)`; reservas antigas ficam `legacy` |
| Pedidos existentes | IDs e referências permanecem intactos |

## Comportamento

- O backend determina o modo exclusivamente por `STRIPE_SECRET_KEY` (`sk_test_` ou `sk_live_`). Ausência/prefixo inválido bloqueiam a operação; o frontend não escolhe modo. O cliente SDK é recriado quando a chave muda, inclusive rotação no mesmo modo.
- Consultas de conexão filtram usuário **e modo**. Status, criação de conta, onboarding, refresh/return e checkout não fazem fallback para o outro modo nem para `legacy`. Uma defesa adicional recusa objetos de outro modo antes de retrieve/link.
- Sem conta do modo atual, GET status retorna 200 com `connected: false` e flags false, sem consulta Stripe. GET nunca cria conta.
- POST account/onboarding cria a conta faltante usando a chave atual; persiste apenas a linha desse modo antes de gerar Account Link. Retry/refresh reutiliza somente a conta desse modo. O body do cliente não fornece o ID utilizado.
- Uma conta Test pode ser criada mantendo a conta Live ou a linha `legacy` intacta. Uma conta Live pode ser criada mantendo Test intacta.
- **Exceção deliberada:** sem conta Live classificada, se houver uma conta ou reserva `legacy`, criação Live retorna `CONNECT_LEGACY_CLASSIFICATION_REQUIRED` (409), antes de chamar Stripe. Isso evita uma segunda conta possivelmente Live. Uma conta Live já classificada é reutilizada normalmente, mesmo se sua reserva histórica continuar legada.
- Reserva RPC nova: `reserve_stripe_account_for_mode(uuid,text,jsonb)`, somente service role. Parâmetros e janela de 23 horas são independentes por modo. A chave de idempotência incorpora modo e usuário. Reservas legadas nunca são reutilizadas pelo novo fluxo; não se reinicia uma tentativa expirada automaticamente.
- A RPC antiga permanece com sua assinatura, mas falha com `CONNECT_MODE_REQUIRED` para impedir novas criações pelo código antigo.
- O trigger impede substituir ID/usuário ou reclassificar contas Test/Live. Permite somente classificação explícita `legacy -> test/live` por operação privilegiada. A unicidade impede substituir uma conta já existente no destino.
- Webhooks de modo diferente do backend são ignorados antes de consultas ao banco/Stripe. Eventos de conta e pagamento exigem vínculo classificado do modo atual antes de chamadas Stripe. Pedidos de outro ID são rejeitados antes de reutilizar sessão de checkout.
- RLS/permissões existentes são preservadas; clientes autenticados continuam sem poder escrever conexões/reservas.

Contrato de GET `/api/stripe/connect/status` e POST `/api/stripe/connect/account`:

```json
{
  "success": true,
  "mode": "test",
  "connected": false,
  "onboardingComplete": false,
  "detailsSubmitted": false,
  "chargesEnabled": false,
  "payoutsEnabled": false,
  "onboardingStatus": "not_connected",
  "requirements": {"currentlyDue": [], "eventuallyDue": []}
}
```

`onboardingComplete` significa `details_submitted`: envio do formulário, não aprovação nem habilitação de pagamentos. `chargesEnabled` e `payoutsEnabled` permanecem independentes. O POST da rota **status** continua configurando métodos de pagamento do produto; usa a conexão do modo atual quando habilita cartão. A UI mostra o modo informado pelo backend, sem inferir modo durante loading/erro.

Escopo: uma plataforma Stripe e um ambiente Test/Sandbox configurado. Diferentes sandboxes ou plataformas podem usar chaves com o mesmo prefixo. Não troque de plataforma/sandbox presumindo que `test` identifica todos eles; isso exige reconciliação ou uma dimensão adicional de ambiente. Nunca altere o modo de uma linha para tentar contornar `resource_missing`.

## Ordem exata das migrations

Instalação nova: aplicar a cadeia completa, na ordem:

1. `20260811000000_production_baseline.sql`
2. `20260811120000_products_v2.sql`
3. `20260812100000_products_v2_advanced.sql`
4. `20260812150000_checkout_studio.sql`
5. `20260812180000_social_v1.sql`
6. `20260831223000_affiliates_v1.sql`
7. `20260903110000_stripe_connect_foundation.sql`
8. `20260904120000_stripe_payments.sql`
9. `20260908235100_fix_stripe_account_id_format.sql`
10. `20260909001000_stripe_checkout_integrity.sql`
11. **`20260909010000_stripe_connect_modes.sql`** (nova nesta correção).

Instalação existente: a migration 11 corrigida é autossuficiente para as dependências Connect, inclusive sem `stripe_account_requests`, `stripe_capabilities` ou trigger de identidade. Execute somente o arquivo 11 completo; não é necessário executar a migration de pagamentos antes para suprir esses objetos. Consulte a [auditoria de schema legado](stripe-connect-legacy-schema-audit.md). As migrations anteriores não são todas idempotentes; não reaplique a cadeia às cegas nem marque a migration de pagamentos como aplicada apenas porque os objetos Connect foram preparados. Checkout/ledger continuam exigindo seu próprio schema. A migration 11 é transacional, idempotente e preserva IDs/flags, FKs e modos já classificados. Pode adquirir locks durante DDL; programe uma janela curta.

## Aplicar no Supabase, depois da revisão

1. Confirme o projeto Supabase e o ambiente Vercel corretos. Faça backup/exportação segura das tabelas `stripe_connected_accounts` e `stripe_account_requests` que existirem, e confira os FKs de `stripe_checkout_orders` caso ela exista. Não publique IDs completos em logs/tickets.
2. Confira `supabase_migrations.schema_migrations` (se administrado pela CLI) e o catálogo do banco. Para aplicações históricas via SQL Editor, use o registro operacional junto ao catálogo; ausência no histórico não significa que o DDL esteja ausente.
3. Prepare o deployment corrigido, com todas as alterações relacionadas presentes no workspace e os checks abaixo passando. O workspace já tinha alterações não commitadas antes desta tarefa; revise o conjunto completo, inclusive dependências Stripe já existentes.
4. Suspenda temporariamente tráfego de Connect/checkout e processamento de webhooks durante a troca. Não deixe o deployment antigo atender após a migration: o código antigo não filtra modo, e a proteção da RPC não impede seus reads. Proteja também URLs antigas de deployments acessíveis ao público. Mantenha os webhooks disponíveis para retry posterior; não responda sucesso a eventos que não foram processados durante manutenção.
5. No SQL Editor, como administrador, abra e execute **todo** `supabase/migrations/20260909010000_stripe_connect_modes.sql`, incluindo BEGIN/COMMIT. A migration solicita reload do cache PostgREST. Alternativa CLI: revise `supabase db push --dry-run` e só aplique se a lista pendente corresponder ao que foi revisado; não use reset/repair para esconder divergências.
6. Confirme que os IDs, flags, quantidade de conexões e pedidos continuam iguais. Conexões anteriores sem modo recebem `legacy`; modos já classificados devem permanecer inalterados. Confira o índice `(user_id,stripe_mode)`, PK das reservas, trigger, RLS e grants da RPC. Pode consultar sem expor IDs:

```sql
select stripe_mode, count(*) from public.stripe_connected_accounts group by stripe_mode;
select stripe_mode, count(*) from public.stripe_account_requests group by stripe_mode;
select indexname, indexdef from pg_indexes
where schemaname='public' and tablename in ('stripe_connected_accounts','stripe_account_requests');
```

7. Se a migration falhar, não apague dados nem reaplique migrations anteriores indiscriminadamente. Corrija a causa indicada e reexecute a migration 11 completa. Só retire a manutenção após o novo backend estar validado.

## Publicar depois

1. Revisar o diff completo e executar `npm test -- src/test/stripe`, `npm run typecheck`, `npm run lint`, `npm run build` com Node compatível. Esta entrega não faz commit, push, deploy nem aplica SQL remoto.
2. Na janela acima, confirmar migration 11 aplicada antes de promover o backend corrigido. Configurar `STRIPE_SECRET_KEY` Test no servidor, `APP_URL`, Supabase URL/service role e o webhook secret correto; manter `STRIPE_LIVE_PAYMENTS_ENABLED=false`. Não criar variável pública para a secret. Configurar o mesmo ambiente/plataforma Stripe esperado para os IDs desse modo.
3. Publicar o conjunto revisado, então validar autenticado: GET status responde `mode: test`, sem buscar legado/Live; POST onboarding gera link Test; retry gera novo link da mesma conta; retorno atualiza flags Test.
4. Conferir Supabase e logs Stripe do ambiente Test: somente o ID Test foi usado. Confirmar novamente a preservação integral da linha Live/legada. Reabrir tráfego e processar retries dos webhooks compatíveis com o ambiente.
5. Para ativar Live futuramente, primeiro classificar/reconciliar legado. Chave Live, webhook Live e autorização para cobrança real são decisões separadas; onboarding Test não comprova pagamentos reais. Não reverta para o backend antigo após a separação sem bloquear as rotas: ele não conhece a nova unicidade.

## Primeiro onboarding TEST preservando LIVE

1. Não classificar o legado como Test. Pode permanecer `legacy` durante todo o teste.
2. Aplicar migration 11 e publicar a correção conforme acima, com backend Test.
3. Abrir Financeiro: GET status retorna `mode: test`, `connected: false`, sem consultar a conta antiga.
4. Clicar em Ativar pagamentos. POST account (ou diretamente POST onboarding) reserva/cria a conta Test, salva `(user_id, 'test', novo_account_id)` e gera seu Account Link. A linha antiga e seus flags não mudam.
5. Completar onboarding usando dados de teste aceitos pela Stripe. Refresh/retry reutiliza exclusivamente a linha Test. Retornar e atualizar o status.
6. Comparar o registro legado/Live com o backup. Deve estar idêntico. Nenhuma remoção ou cópia automática para Test é necessária.

## Classificar o legado explicitamente, em etapa posterior

Verifique o ID exato, proprietário e plataforma no Dashboard Stripe com o ambiente explicitamente selecionado, ou em evidência auditável da criação. Não teste chaves alternadas contra um ID desconhecido para descobrir seu modo. Um log sem indicação de ambiente ou o prefixo `acct_` não basta.

Depois de comprovar Live, executar como administrador em uma transação (substituir os placeholders; não executar enquanto não houver prova):

```sql
begin;
select user_id, stripe_mode, stripe_account_id
from public.stripe_connected_accounts
where user_id = '<UUID_DO_USUARIO>'::uuid for update;

update public.stripe_connected_accounts
set stripe_mode = 'live'
where user_id = '<UUID_DO_USUARIO>'::uuid
  and stripe_mode = 'legacy'
  and stripe_account_id = '<ACCOUNT_ID_LIVE_COMPROVADO>';
-- Exigir exatamente UMA linha atualizada. Confirmar que Test e ID Live não mudaram.
-- Se o resultado não for o esperado, ROLLBACK em vez de COMMIT.
commit;
```

O ID permanece na mesma linha; pedidos mantêm seu FK. Se já existir Live para o usuário, a unicidade faz a operação falhar sem sobrescrita. Investigue/reconcilie; não delete para liberar a constraint. Uma reserva legada pode permanecer legada: conta Live classificada já existente será reutilizada e não precisa nova reserva. Uma reserva sem conta exige investigação da criação original antes de liberar uma nova criação Live; não zere sua data nem migre parâmetros para forçar retry.

## Validação e referências

Testes de modo cobrem ambos os sentidos, contas faltantes, preservação do oposto/legado, status, onboarding/retomada, idempotência, rotação do cliente, webhooks incompatíveis e configuração inválida. PGlite executa PostgreSQL real localmente para validar migration idempotente, FKs, flags, unicidade, guard, RLS/grants, reservas separadas e classificação explícita. Isso não substitui o smoke test autorizado após aplicação/publicação remota.

Fontes oficiais: [Stripe API keys](https://docs.stripe.com/keys), [Testing Connect](https://docs.stripe.com/connect/testing), [Sandboxes](https://docs.stripe.com/sandboxes). A Stripe separa operações Test e Live por credenciais; os ambientes de teste também podem ser distintos entre sandboxes.

## Arquivos desta correção

Arquivos alterados nesta tarefa (alguns já continham trabalho local anterior, preservado):

- Backend: `server/stripe/client.js`, `server/stripe/connect.js`, `server/stripe/onboardingDiagnostics.js`, `server/stripe/payments.js`, `server/stripe/webhook.js`, `api/stripe/connect/onboarding.js`.
- Frontend/service: `src/services/stripeConnectService.ts`, `src/components/finance/StripeConnectCard.tsx`.
- Migration nova: `supabase/migrations/20260909010000_stripe_connect_modes.sql`.
- Testes novos: `src/test/stripeConnectModes.test.ts`, `src/test/stripeConnectModesDatabase.test.ts`, `src/test/stripeConnectModeEndpoints.test.ts`.
- Testes atualizados: `src/test/stripeConnectBackend.test.ts`, `src/test/stripeConnectOnboarding.test.ts`, `src/test/stripeConnectPersistenceDatabase.test.ts`, `src/test/stripeConnectAccountIdMigration.test.ts`, `src/test/stripePayments.test.ts`, `src/test/stripePaymentsDatabase.test.ts`.
- Documentação: este arquivo, `docs/stripe-integration.md`, `docs/stripe-connect-onboarding-diagnosis.md`, `docs/stripe-connect-persistence-audit.md`.

Os handlers `api/stripe/connect/status.js` e `account.js` já usam os helpers centrais; recebem a seleção por modo e o novo contrato sem precisar de reescrita local. Outras diferenças existentes no `git status` não foram produzidas por esta correção.

## Resultado da execução local anterior à correção de schema legado

- Vitest, filtro `src/test/stripe`: **201 testes passaram em 11 arquivos** (inclui Connect, endpoints, segurança, routing, migrations PostgreSQL e pagamentos).
- `tsc -b` / typecheck: passou, sem erros.
- `eslint .`: passou, sem erros ou avisos.
- `npm run build` (`tsc -b && vite build`): passou. Vite informou chunk `auth` vazio e chunks maiores que 500 kB; avisos não bloqueantes.
- `git diff --check`: passou.

O shell não tinha Node no PATH. Foi utilizado Node 22.16.0 temporariamente em `/tmp`, sem alteração em dependências/package-lock nesta tarefa. Testes Stripe usam doubles do SDK; os testes de banco executam PostgreSQL via PGlite. Nenhuma chamada de onboarding real, migration remota, classificação do legado, commit, push ou deploy foi executada.

A correção posterior para instalações sem reservas e seus resultados estão na [auditoria de schema legado](stripe-connect-legacy-schema-audit.md).
