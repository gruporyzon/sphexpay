# Compatibilidade da migration de modos com schema legado

## Diagnóstico

O erro `42P01: relation "public.stripe_account_requests" does not exist` informado em Production comprova que essa tabela estava ausente naquele momento. Não comprova por que: a migration que a cria pode não ter sido aplicada, pode ter falhado ou o schema pode ter sido alterado depois. Não foi consultado o histórico remoto nesta correção.

Foram examinadas as 11 migrations do repositório. As seis primeiras (baseline, products v2, products advanced, checkout studio, social e affiliates) não criam objetos Stripe. A origem dos objetos é:

| Migration | Objetos relevantes |
| --- | --- |
| `20260903110000_stripe_connect_foundation.sql` | `stripe_connected_accounts`, PK `id`, FK `user_id -> auth.users`, unicidade por usuário/ID Stripe, CHECKs, índice de status, RLS, policy e grants |
| `20260904120000_stripe_payments.sql` | `stripe_capabilities`; `stripe_account_requests(user_id uuid PK/FK, parameters jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`; RPC antiga de reserva; função **e trigger** de identidade; permissões; tabelas/RPCs separadas de pagamentos |
| `20260908235100_fix_stripe_account_id_format.sql` | Correção do CHECK de formato do account ID; não cria reservas |
| `20260909001000_stripe_checkout_integrity.sql` | `checkout_origin` nos pedidos e atualização da RPC financeira; não cria reservas |
| `20260909010000_stripe_connect_modes.sql`, versão anterior | Presumia as dependências Connect acima; falhava se a tabela de reservas faltasse |

`ensureConnectedAccount` chama `reserve_stripe_account_for_mode` antes de criar conta na Stripe. Essa RPC depende da tabela de reservas, de seus parâmetros originais, timestamp e unicidade por modo. A tabela é **obrigatória para novas criações**, mesmo que GET status/onboarding de uma conta já vinculada não precise criar reserva.

## Auditoria completa das premissas anteriores

- Tabelas diretamente usadas: `public.stripe_connected_accounts` e `public.stripe_account_requests`. A segunda aparecia tanto no ALTER quanto no `%rowtype` e no corpo da RPC.
- Colunas: `user_id`, `stripe_account_id` da conexão; `user_id`, `parameters`, `created_at` da reserva. O backend também seleciona todos os campos da foundation e `stripe_capabilities`, que poderia estar ausente junto com a migration de pagamentos.
- Constraints/índices: unicidade global de `stripe_account_id` e PK/FKs da foundation eram preservadas implicitamente; removia `stripe_connected_accounts_user_id_key` e recriava `stripe_account_requests_pkey`, presumindo seus nomes. Índice `(user_id,stripe_mode)` era criado. CHECKs de modo eram adicionados junto com as novas colunas.
- Funções: `CREATE OR REPLACE` não exigia funções antigas, mas a nova RPC exigia a tabela via `%rowtype`. A função `stripe_connection_identity_guard()` era criada/substituída.
- Trigger: a versão anterior **não criava** `stripe_connection_identity_guard` quando ausente. Atualizar a função sozinha não instalava a proteção.
- Segurança: dependia de RLS/grants pré-existentes nas tabelas e dos grants da RPC antiga. Se a função antiga fosse criada do zero, era necessário revogar EXECUTE público explicitamente.
- Infraestrutura: schema `public`, Supabase Auth (`auth.users`, `auth.uid()`), roles `anon`, `authenticated`, `service_role`, PostgreSQL com `gen_random_uuid()`, catálogos PostgreSQL e PostgREST para receber a notificação de reload. Esses objetos pertencem ao Supabase; a migration não fabrica um sistema de autenticação alternativo.
- `stripe_checkout_orders`, `stripe_webhook_events`, `apply_stripe_payment`, produtos e ledger **não são dependências desta migration ou da reserva Connect**. Não são criados nem modificados por ela. Se ausentes, checkout/pagamentos/webhooks precisam de reconciliação própria antes de serem habilitados.

## Correção

A migration agora cria `stripe_connected_accounts` e `stripe_account_requests` com `CREATE TABLE IF NOT EXISTS` usando as definições Connect do histórico; acrescenta `stripe_capabilities` quando ausente; instala o trigger efetivo; assegura índices, RLS, policy de leitura e grants das duas RPCs e tabelas. Apenas as colunas adicionais recebem defaults; valores existentes não são atualizados.

A unicidade global somente de `user_id` é identificada no catálogo, inclusive com nomes legados diferentes. É substituída pela unicidade `(user_id,stripe_mode)`. PKs de `id`, unicidade do account ID, chaves compostas e FKs existentes são preservadas. A PK composta das reservas não é removida na reexecução. Não há DELETE/TRUNCATE, alteração de account ID ou classificação automática. Contas já classificadas continuam no mesmo modo; contas anteriores sem modo recebem `legacy`.

Não há `CASCADE`. Se uma customização tiver FK referenciando a antiga unicidade **somente por usuário**, a migration falha atomicamente em vez de remover a referência: esse caso exige modelagem explícita, pois um usuário passa a ter várias contas. Divergências arbitrárias de tipos/colunas ou dados inválidos não são corrigidas inventando identidades nem apagando registros.

## Aplicação e rollback

Para a instalação Supabase descrita, **não é preciso executar a migration de pagamentos antes desta**. O arquivo corrigido é autossuficiente para as dependências de Connect e aceita tanto a foundation sozinha quanto todas as tabelas antigas ou ausência das duas tabelas Connect. Execute o arquivo inteiro, como administrador, mantendo a janela de troca de backend descrita no roteiro Test/Live.

Isso não significa que a migration de pagamentos foi integralmente aplicada: não marque seu histórico como aplicado nem execute sua versão antiga às cegas depois, pois ela contém DDL não idempotente e cria também objetos financeiros fora deste escopo.

Como a execução relatada estava em BEGIN e falhou antes de COMMIT, **nenhuma alteração daquela transação pode ter sido persistida**. PostgreSQL coloca a transação em estado abortado até ROLLBACK/encerramento da sessão; não é correto afirmar que consultamos o estado da sessão remota. Se o editor mantiver a mesma sessão abortada, execute ROLLBACK antes de reenviar o arquivo completo. Isso não desfaz transações anteriores já commitadas.

## Testes

`src/test/stripeConnectLegacySchema.test.ts` executa SQL real em PGlite com quatro schemas: foundation sem reservas/capabilities/trigger; reservas existentes sem os demais objetos e com constraints renomeadas; Connect completo; nenhuma tabela Connect. Verifica criação/retry de reserva e persistência com service role, preservação de cada coluna legada/FKs, grants, trigger real, reexecuções e manutenção de uma conta Live já classificada. Também reproduz o erro anterior e seu rollback, e verifica que uma FK inesperada não é destruída.

Os testes já existentes de modos e de pagamentos continuam executando a migration com schema completo.

Resultado desta correção: **227 testes Stripe/Connect passaram em 12 arquivos**; `npm run typecheck`, `npm run lint`, `npm run build` e `git diff --check` passaram. O build emitiu avisos não bloqueantes de chunk `auth` vazio e chunks maiores que 500 kB. Node 22.16.0 temporário em `/tmp`, sem alteração de dependências. Não houve execução SQL remota, classificação de IDs, commit, push ou deploy.

Arquivos desta rodada: migration corrigida, novo teste `src/test/stripeConnectLegacySchema.test.ts`, esta auditoria e atualização do roteiro `docs/stripe-connect-test-live.md`. Demais alterações locais anteriores foram preservadas.
