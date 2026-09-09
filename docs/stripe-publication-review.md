# Revisão da publicação Stripe

Publicação preparada sobre `origin/main` em `4e647900db8c77b75d6f2cc08f05873d257a3fca`, preservando os dois commits de segurança/KYC que estavam à frente da cópia local. O projeto local Vercel é `sphexpay`; o remoto Git é `gruporyzon/sphexpay`, branch `main`.

O usuário confirmou a aplicação bem-sucedida da migration de modos em Production: uma conexão legada preservada, modo `legacy`, status `pending` e flags false, sem vínculos Test/Live. Esta preparação não executa migrations, não altera o registro legado, não altera variáveis Vercel e não inicia onboarding.

## Escopo do commit

Somente alterações Stripe: Connect por modo, onboarding/status/persistência, checkout/webhooks oficiais, migrations, testes e documentação. As mudanças de autenticação, MFA, KYC e headers de segurança já estavam no remoto e permanecem como ancestrais, não como novas alterações deste commit.

A resolução do webhook compartilhado preserva a assinatura HMAC com timestamp, rotação, allowlist e auditoria do parceiro. O endpoint Stripe usa sua assinatura oficial. Como a versão remota desativou o bodyParser, o POST de checkout foi adaptado para ler JSON do stream; testes cobrem esse fluxo e limite de tamanho. A rota pública de pagamento foi adicionada sem remover as rotas/proteções remotas.

## Verificação de credenciais

Os arquivos completos da publicação foram inspecionados por padrões de chaves Stripe/OpenAI, webhook, Supabase, JWTs, tokens GitHub/AWS, chaves privadas e URLs com credenciais; também foram comparados, sem imprimir valores, com os segredos presentes nos arquivos de ambiente locais. Não houve correspondência de credencial real. Duas URLs `user:password` são fixtures sintéticas de rejeição em testes. Chaves/assinaturas fictícias dos testes não são credenciais funcionais.

Somente `.env.example` entra no commit, com campos privados vazios. `.env`, `.env.local`, `.vercel`, node_modules, dist e arquivos temporários não entram.

## Validação

- `npm test -- src/test/stripe src/test/webhookSecurity.test.ts src/test/securityHeaders.test.ts src/test/vercelFunctionLimit.test.ts`: 243 testes passaram em 15 arquivos.
- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm run build`: passou; avisos não bloqueantes de chunk `auth` vazio e chunks acima de 500 kB.
- `git diff --check`: passou; o índice final também é verificado antes do commit.

A auditoria adicional `npm audit --omit=dev` retornou quatro alertas (3 altos, 1 moderado) em versões já presentes no remoto: nanoid, postcss, react-router e react-router-dom. Essas versões não foram alteradas por esta publicação. Atualizações dessas dependências ficam fora do escopo por instrução explícita do usuário de não incluir alterações não relacionadas à integração Stripe; precisam de manutenção separada. O único acréscimo ao package-lock é PGlite, dependência de desenvolvimento dos testes SQL.

## Arquivos incluídos

- `.env.example`
- `api/payments/webhook.js`
- `api/stripe/connect/onboarding.js`
- `api/stripe/connect/status.js`
- `docs/sql/stripe-connect-account-id-counts.sql`
- `docs/sql/stripe-connect-inspect.sql`
- `docs/sql/stripe-connect-onboarding-state.sql`
- `docs/stripe-connect-legacy-schema-audit.md`
- `docs/stripe-connect-onboarding-diagnosis.md`
- `docs/stripe-connect-persistence-audit.md`
- `docs/stripe-connect-test-live.md`
- `docs/stripe-integration.md`
- `docs/stripe-publication-review.md`
- `package-lock.json`
- `package.json`
- `server/stripe/client.js`
- `server/stripe/connect.js`
- `server/stripe/onboardingDiagnostics.js`
- `server/stripe/payments.js`
- `server/stripe/webhook.js`
- `src/App.tsx`
- `src/components/finance/StripeConnectCard.tsx`
- `src/features/products/CheckoutStudio.tsx`
- `src/features/products/ProductsV2.tsx`
- `src/features/products/StripePaymentPage.tsx`
- `src/services/stripeConnectService.ts`
- `src/test/stripeConnectAccountIdMigration.test.ts`
- `src/test/stripeConnectBackend.test.ts`
- `src/test/stripeConnectLegacySchema.test.ts`
- `src/test/stripeConnectModeEndpoints.test.ts`
- `src/test/stripeConnectModes.test.ts`
- `src/test/stripeConnectModesDatabase.test.ts`
- `src/test/stripeConnectOnboarding.test.ts`
- `src/test/stripeConnectPersistenceDatabase.test.ts`
- `src/test/stripePayments.test.ts`
- `src/test/stripePaymentsDatabase.test.ts`
- `src/test/stripeRouting.test.ts`
- `supabase/migrations/20260904120000_stripe_payments.sql`
- `supabase/migrations/20260908235100_fix_stripe_account_id_format.sql`
- `supabase/migrations/20260909001000_stripe_checkout_integrity.sql`
- `supabase/migrations/20260909010000_stripe_connect_modes.sql`
- `vercel.json`
