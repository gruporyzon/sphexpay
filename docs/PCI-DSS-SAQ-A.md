# PCI-DSS — Avaliação de prontidão (SAQ-A)

> Este documento é uma **avaliação interna de prontidão**, não um atestado de conformidade.
> A conformidade formal depende do parceiro processador validado PCI DSS e da submissão da
> SAQ correta ao adquirente/bandeira. Enquanto não houver processador real integrado, a
> SphexPay não processa pagamentos.

## 1. Escopo e elegibilidade

**Parceiro processador em integração: Stripe (Connect, contas Express).** O onboarding do
vendedor é feito por link **hospedado pela Stripe** (`api/stripe/connect/onboarding.js` →
`stripe_connected_accounts` guarda apenas `acct_…` e flags de status). A captura de dados de
cartão do comprador ocorre em página/campos **hospedados pela Stripe** (Checkout / Elements),
nunca no domínio ou nos servidores da SphexPay.

A SphexPay opera **exclusivamente via este parceiro processador (validado PCI DSS Nível 1)**,
com a captura de dados de cartão feita em página/iframe **hospedada e servida pelo parceiro**.
Nesse desenho:

- A SphexPay **não armazena, processa nem transmite** dados de conta de cartão.
- Todo o formulário de cartão é entregue pelo domínio do parceiro.

Isso enquadra o comerciante (SphexPay como plataforma / e os vendedores) na **SAQ-A**, desde
que **todas** as condições da SAQ-A sejam mantidas:

1. Aceita apenas transações não presenciais (e-commerce).
2. Todo o processamento é terceirizado a provedores validados PCI DSS.
3. A SphexPay não armazena, processa nem transmite dados de conta em nenhum sistema ou meio
   físico.
4. As páginas de pagamento vêm inteiramente do(s) provedor(es) validado(s).
5. A SphexPay confirmou que seus sistemas não recebem dados de conta.

**Risco a monitorar:** se o produto passar a embutir campos de cartão próprios, usar um SDK
que colete o PAN no nosso frontend, ou fazer proxy do PAN, o escopo migra para SAQ A-EP ou
D. Qualquer proposta nesse sentido exige revisão de segurança e provavelmente inviabiliza a
SAQ-A.

## 2. Matriz de responsabilidade (resumo)

| Área | SphexPay | Parceiro processador |
| --- | --- | --- |
| Página de captura de cartão | — | Stripe (Checkout / Elements hospedado) |
| Armazenamento/transmissão de PAN | Não aplicável (não ocorre) | Stripe |
| Tokenização e cofre de cartão | — | Stripe |
| Onboarding e KYC do vendedor | Só guarda `acct_…` + flags | Stripe (Connect Express, link hospedado) |
| Antifraude sobre o dado do cartão | — | Stripe (Radar, 3DS) |
| Autenticação dos usuários da plataforma | Responsável | — |
| Proteção do webhook e dos dados de transação (nosso lado) | Responsável | Assina os eventos |
| Gestão de segredos da integração | Responsável (nosso env) | Responsável (lado dele) |
| Trilha de auditoria da plataforma | Responsável | — |
| Submissão da SAQ ao adquirente | Responsável (com apoio do parceiro) | Fornece AOC |

## 3. Checklist de gaps

Legenda: **Feito** · **Parcial** · **A fazer**

| # | Requisito PCI (tema) | Item | Status | Evidência / próximo passo |
| --- | --- | --- | --- | --- |
| 1 | Rede / firewall | App serverless sem rede própria; superfície = funções `api/*` | Feito | Vercel gerencia a borda |
| 2 | Sem senhas padrão | Sem credenciais default; segredos por env | Feito | `SECURITY.md` §9 |
| 3 | Proteção de dados de titular | Nenhum PAN armazenado | Feito | `DATA-CLASSIFICATION.md` |
| 4 | Criptografia em trânsito | HTTPS obrigatório + HSTS | Feito | `vercel.json` |
| 5 | Antivírus | N/A (sem servidores gerenciados por nós) | N/A | — |
| 6 | Desenvolvimento seguro | Revisão de código, `npm audit`, testes de segurança | Parcial | Rodar `npm audit` por release; registrar em `SECURITY.md` §11 |
| 6.4 | Scripts na página de pagamento | Página de pagamento é do parceiro; CSP na SphexPay | Parcial | Promover CSP de Report-Only para enforcing |
| 7 | Acesso por necessidade | RLS forçada, GRANTs mínimos, papel admin explícito | Feito | `20260908120000_security_hardening.sql` |
| 8.2 | Identificação única | Contas individuais no Supabase Auth | Feito | — |
| 8.3 | MFA para acessos | MFA TOTP com enforcement em rotas sensíveis | Parcial | Ativo e opt-in; tornar obrigatório para contas com papel admin |
| 9 | Acesso físico | N/A (nuvem) | N/A | Coberto pelos data centers da Vercel/Supabase |
| 10 | Registro e monitoramento | `security_audit_log` + logs da Vercel/Supabase | Parcial | Definir retenção/alerta; agendar `prune_security_audit_log()` |
| 11 | Testes de segurança | Testes automatizados de headers/webhook/RLS | Parcial | Scan ASV se exigido; pentest antes de produção |
| 12 | Política de segurança | Este documento + `SECURITY.md` | Parcial | Formalizar política, treinamento anual, revisão de acesso trimestral |
| — | Webhook | Assinatura HMAC + timestamp + rotação + auditoria | Feito | `api/payments/webhook.js`, `webhookSecurity.test.ts` |

## 4. Passos operacionais fora do código

- [ ] **Stripe:** definir `STRIPE_SECRET_KEY` / `STRIPE_API_KEY` nas variáveis da Vercel
      (server-side). Aplicar a migration `20260903110000_stripe_connect_foundation.sql`.
- [ ] **Stripe webhooks:** quando forem adicionados, o handler deve validar assinatura com
      `stripe.webhooks.constructEvent` sobre o corpo bruto — reutilizar o padrão de
      `api/payments/webhook.js` (timestamp + assinatura + auditoria).
- [ ] Obter o **AOC (Attestation of Compliance)** do parceiro processador (Stripe publica o seu) e guardá-lo.
- [ ] Confirmar com o adquirente **qual SAQ** se aplica ao modelo de integração final.
- [ ] Preencher e assinar a **SAQ-A** oficial (não este documento).
- [ ] Executar **scan ASV** trimestral se o adquirente exigir.
- [ ] **Pentest** externo antes de habilitar pagamentos reais.
- [ ] Definir e treinar a **política de segurança da informação** (Req. 12).
- [ ] **Revisão de acessos** trimestral (usuários do Supabase, membros do projeto Vercel).
- [ ] Tornar **MFA obrigatório** para operadores com papel `admin`.
- [ ] Agendar `prune_security_audit_log()` (pg_cron ou rotina) e alertas sobre
      `webhook.rejected` em volume anômalo.
- [ ] Promover a **CSP** para modo enforcing após validação.

## 5. Proteção contra fraude (nosso lado)

O scoring de fraude sobre o dado do cartão é responsabilidade do parceiro. Do nosso lado:

- Idempotência de eventos (`payment_transaction_events`) evita duplicidade por replay.
- Verificação de assinatura + timestamp no webhook evita injeção de eventos forjados.
- `checkout_ownership_guard` e RLS impedem que um vendedor referencie produtos/ofertas de
  outro.
- Trilha `security_audit_log` para investigação.
- Próximo passo (fora desta rodada): regras de anomalia sobre `payment_transactions`
  (picos de chargeback/refund por vendedor, velocidade de aprovação), dependente de volume
  real de dados do parceiro.
