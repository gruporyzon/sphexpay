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

### Eventos financeiros e Web Push

O envio reutilizável está em `api/push/send-service.js`, e a tradução dos eventos financeiros confirmados está em `api/push/financial-events.js`. Essa camada aceita `sale_approved`, `sale_pending`, `pix_created`, `pix_paid`, `card_approved`, `card_declined`, `boleto_created`, `boleto_paid`, `subscription_approved`, `subscription_renewed` e `withdrawal_completed`.

Esses eventos devem ser chamados somente depois que um backend ou webhook oficial confirmar a operação. O ambiente atual não possui um provedor oficial de pagamentos conectado; por isso, vendas, Pix, cartão, boleto, assinaturas e saques demonstrativos do frontend não disparam Push financeiro. Quando um provedor for integrado, seu webhook deve validar assinatura e idempotência, persistir a mudança financeira e então chamar `notifyConfirmedFinancialEvent`. Falhas de Push devem ser registradas, mas nunca reverter a operação financeira confirmada.
