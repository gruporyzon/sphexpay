# SphexPay

Painel financeiro e gateway de pagamentos **demonstrativo**, construído com React, TypeScript, Vite, Tailwind CSS, Recharts e Zustand.

## Execução

```bash
export PATH="$PWD/.runtime/bin:$PATH"
npm install
npm run dev
```

Abra `http://127.0.0.1:4173`.

## Aviso

Todos os clientes, contas, vendas, saldos e transações são fictícios e persistidos somente no `localStorage` do navegador. Não existe processamento bancário, custódia, liquidação ou conexão com APIs financeiras reais nesta versão.

## Supabase

Para um projeto novo, execute `supabase/schema.sql`. Em um projeto SphexPay já existente, aplique em ordem:

1. `supabase/migrations/20260724190000_secure_withdrawals.sql`
2. `supabase/migrations/20260724210000_device_notifications_only.sql`
3. `supabase/migrations/20260724230000_sandbox_withdrawals_and_wallets.sql`
4. `supabase/migrations/20260725010000_push_delivery_diagnostics.sql`

As subscriptions Web Push e o log de entregas ficam nas tabelas persistentes `push_subscriptions` e `push_delivery_log`. A chave `SUPABASE_SERVICE_ROLE_KEY` e a chave privada VAPID pertencem somente ao backend.
