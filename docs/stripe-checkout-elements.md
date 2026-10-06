# Checkout Stripe incorporado — 06/10/2026

O checkout público mantém o layout personalizável e adiciona Checkout Elements oficial.
O backend aceita `uiMode: elements`; a opção hospedada permanece compatível. Não há
campos PAN/CVV na SphexPay: Payment Element coleta cartão diretamente em iframe Stripe.

Nome/e-mail iniciam uma reserva idempotente. Conta Connect, valor e taxa vêm do servidor.
A migration `20261006025244_stripe_checkout_elements.sql` congela o modo de apresentação
na reserva, inclusive após timeout. Retries preservam parâmetros e sessão. O navegador
guarda apenas hash dos dados do comprador e UUID, nunca client secret ou cartão.

A confirmação consulta a sessão oficial na conta do pedido e só mostra confirmação
registrada quando o webhook oficial também atualizou o pedido. Em Live, isso também
atualiza o ledger; Test não gera receita nem notificações financeiras. Parâmetro de retorno
sozinho não prova pagamento. Assinatura e escrita financeira permanecem no servidor.

## Configuração e limites

- `APP_URL=https://www.sphexpay.com.br` para retorno público e Connect autenticado.
- `STRIPE_SECRET_KEY` e `VITE_STRIPE_PUBLISHABLE_KEY` devem pertencer à mesma plataforma
  e modo. `STRIPE_WEBHOOK_SECRET` deve corresponder à destination Connected accounts /
  Snapshot em `https://www.sphexpay.com.br/api/stripe/webhook`.
- LIVE exige conta Live do vendedor com cobranças/repasses habilitados e
  `STRIPE_LIVE_PAYMENTS_ENABLED=true`. Não misturar conta Test e chave Live.
- Esta publicação não habilita LIVE: a conta do vendedor é Test/Sandbox. A plataforma
  Live está com `charges_enabled=false`, `payouts_enabled=false` e
  `requirements.disabled_reason=requirements.pending_verification`. Não há vendedor Live
  conectado. A ativação/verificação da empresa precisa ser concluída pelo titular.
- Cartão à vista para oferta única publicada. Pix, boleto, parcelas e assinaturas não
  são implementados por este fluxo. Recibo é solicitado à Stripe pelo `receipt_email`;
  envio efetivo depende do modo e da configuração Stripe.
- Rate limiting por instância: 30 criações/min e 90 consultas/min por IP, sem bloqueio
  de webhook. Em escala, substituir o armazenamento em memória por store compartilhado.
- CSP enforcing em `/pay/*`; Stripe/Link oficiais permitidos. Outras rotas conservam
  o estado Report-Only. As 12 funções Vercel permanecem preservadas.

## Validação

Testes de backend com transporte simulado, frontend com SDK simulado e migrations reais
em PGlite cobrem preço imutável, retries, recusa/recuperação, apresentação reservada,
sessão de outro checkout, verificação de conta/modo/valor e ledger sem duplicação.
Homologação no domínio público deve ser registrada separadamente; teste automatizado
não equivale a cobrança LIVE nem certifica habilitação da conta Stripe.

Validação final: 329 testes passaram em 22 arquivos Stripe/checkout/segurança,
incluindo três novos casos de isolamento financeiro Test/Live e proteção de contas legadas;
TypeScript, lint e build passaram; auditoria das dependências de produção sem avisos.
A suíte geral teve 832 aprovações e 26 falhas em testes de landing/máscaras existentes,
fora dos arquivos alterados nesta integração. Não declarar a suíte geral inteiramente verde.
A migration foi aplicada ao projeto Supabase atual e foram conferidos RLS forçada,
ausência de SELECT para anon/authenticated e INSERT disponível para service_role.

Homologação no domínio público concluída em Sandbox após corrigir a chave expirada e o
ambiente: as chaves existentes de “Área restrita de SphexPay” foram configuradas na Vercel,
e uma destination Connect/Snapshot foi criada no mesmo sandbox para o domínio público.
Chaves e signing secret ficaram apenas em variáveis de ambiente; não no código ou neste relatório.

O checkout publicado abriu Payment Element oficial. Um cartão fictício recusado mostrou
“Seu cartão foi recusado”; trocar pelo cartão fictício aprovado concluiu a mesma sessão/pedido.
O GET de confirmação retornou HTTP 200, `status=paid`, `recorded=true` e `Cache-Control: no-store`.
Foram registrados os cinco eventos assinados de recusa/aprovação/Checkout: um pedido aprovado,
zero transações Stripe no ledger e zero notificações financeiras de Test. A migration
`20261006184000_stripe_sandbox_financial_isolation.sql` foi aplicada antes da homologação:
Test mantém ordem e auditoria; Live mantém ledger/outbox; contas legadas sem modo precisam
ser classificadas por reconciliação. Não foram removidos pedidos, recibos ou registros existentes.

A disponibilidade reconsulta a conta Stripe; flags antigas no banco não liberam CTA.
Diagnósticos excluem chaves e mensagens livres. A checagem de logs desta publicação não
indicou falha de pagamento; houve um aviso de depreciação `url.parse()` no runtime.
O Payment Element avisou que Apple Pay não está habilitado no domínio; o fluxo implementado
é cartão à vista e não anuncia carteiras digitais.

Homologação Sandbox não equivale a recebimento de dinheiro real. Live permanece desligado
até a ativação da plataforma, onboarding do vendedor Live, chaves/webhook do mesmo ambiente
e validação de produção autorizada pelo titular.
