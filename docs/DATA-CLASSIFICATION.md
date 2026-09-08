# Classificação de dados — SphexPay

Níveis: **Público** · **Interno** · **Confidencial** · **Restrito** (o mais sensível).

## Princípio central

A SphexPay **não captura, não processa, não transmite e não armazena** dados de conta de
cartão (PAN, CVV, tarja magnética, chip). Todo o dado de cartão é tratado pelo parceiro
processador, em ambiente hospedado por ele. Não há campo, tabela, log ou variável para PAN em
nenhuma camada da SphexPay — e não deve haver.

## Inventário

| Dado | Classificação | Onde é armazenado | Controle de acesso |
| --- | --- | --- | --- |
| Conteúdo público da landing, termos, FAQ | Público | Código / assets | — |
| Catálogo de produtos, ofertas, checkout (schema) | Interno | `products`, `product_offers`, `product_checkouts` | RLS por `seller_id` |
| E-mail e metadados de conta do vendedor | Confidencial | Supabase Auth (`auth.users`) | Supabase; nunca exposto a outro usuário |
| Nome de exibição do comprador | Confidencial | `payment_transactions.customer_display_name` | RLS: só o vendedor dono lê |
| Valores, taxas, comissão, método, status de transação | Confidencial | `payment_transactions`, `payment_transaction_events` | RLS (SELECT dono); escrita só via RPC `service_role` |
| Fila de eventos financeiros | Interno | `financial_event_outbox` | RLS (SELECT dono); processamento `service_role` |
| Assinaturas Web Push (endpoint + chaves p256dh/auth) | Confidencial | `push_subscriptions` | RLS restrita a colunas; escrita `service_role`; endpoint também guardado como hash |
| Conta Stripe Connect do vendedor (`acct_…` + flags de status) | Interno | `stripe_connected_accounts` | RLS (SELECT dono); escrita `service_role`. NÃO guarda chaves nem dados bancários — só o id da conta e flags |
| Cadastro/KYC do merchant (nome legal, CPF/CNPJ, nascimento, telefone, endereço, status) | Confidencial | `kyc_profiles` | RLS por `user_id` (SELECT/INSERT/UPDATE de dados); transição para `pending` só via RPC `kyc_submit()`; aprovação/reprovação só admin ou `service_role`. Leitura adicional por admin (`is_dashboard_admin()`) |
| Documentos de identificação do merchant (imagens/PDF de RG/CNH, comprovante de endereço, contrato social) | Restrito | Bucket privado `kyc-documents` + metadados em `kyc_documents` | Bucket `public=false`; policy em `storage.objects` restringe à pasta `<user_id>/`; upload validado (magic bytes) pela Edge Function `kyc-document-upload` com `service_role`. Analista lê só via **URL assinada de 300 s** gerada no servidor. Retenção: definir política formal antes de produção |
| Trilha de auditoria de segurança | Confidencial | `security_audit_log` | Append-only; leitura só das próprias linhas; escrita `service_role` |
| Segredos de servidor (service role, VAPID, webhook, OpenAI) | Restrito | Env da Vercel (server) | Apenas backend; ver `SECURITY.md` §9 |
| Fator TOTP / secret de MFA | Restrito | Supabase Auth | Gerenciado pelo Supabase; nunca trafega pelo nosso backend |
| Dados bancários do vendedor (agência, dígitos da conta) | Confidencial | Hoje: `localStorage` do navegador (demonstrativo) | Somente o dispositivo do usuário |
| Métricas, clientes, vendas, saldos demonstrativos | Interno (fictício) | `localStorage` | Somente o dispositivo |

## Dados que NÃO existem na SphexPay (e não devem passar a existir)

- PAN (número do cartão), CVV/CVC, dados de tarja/chip, PIN.
- Autenticação 3-D Secure, tokens de rede de cartão.
- Credenciais bancárias completas de terceiros.

Se qualquer integração futura tentar enviar esses dados à SphexPay (por webhook, payload de
API ou formulário), o dado deve ser **rejeitado e não persistido**. O validador
`server/payments/process-payment-event.js` aceita apenas os campos da lista acima.

## Minimização

- O `buyer_form` do checkout não deve coletar CPF, endereço ou telefone do comprador além do
  estritamente exigido pelo parceiro/legislação. Revisar antes de sair do modo demonstrativo.
- Quando os dados bancários do vendedor deixarem de ser demonstrativos, mover de `localStorage`
  para uma tabela com RLS por `user_id` e guardar apenas os últimos dígitos + referência
  opaca; nunca a conta completa.
- KYC: coletar apenas o mínimo necessário para compliance (identidade, endereço, dados da
  empresa se PJ). Nesta versão não há OCR nem envio dos documentos a serviço externo — a
  análise é humana. Reter os arquivos só enquanto houver base legal; definir política de
  expurgo antes de produção.

## Retenção

- `security_audit_log`: 400 dias (`prune_security_audit_log()`).
- `payment_transactions` / eventos: retenção de negócio; definir política formal antes de
  produção (sugestão: 5 anos por obrigação fiscal, depois anonimizar o nome do comprador).
- Assinaturas Push inativas: limpeza periódica (já há colunas de falha/última atividade).
