# Checklist de ativação da segurança

Passos que dependem de painéis externos (Supabase, Vercel) e não entram no código.
Marcar conforme concluir. Detalhes e justificativas em `docs/SECURITY.md`.

## Banco de dados (Supabase)

- [x] Aplicar migration `supabase/migrations/20260908120000_security_hardening.sql`
      (cria `security_audit_log`, RPC `record_security_event`, força RLS, reduz GRANTs).
- [x] Habilitar extensão **`pg_cron`** — Painel Supabase → Database → Extensions → `pg_cron` → Enable.
- [x] Depois de habilitar, agendar a limpeza do log de auditoria (retenção 400 dias):
      ```sql
      select cron.schedule('prune-security-audit','0 3 * * 0',
        $$select public.prune_security_audit_log()$$);
      ```
      Agendado em 2026-10-18 (job `prune-security-audit`, domingos 03:00 UTC). EXECUTE da função
      restrito a `service_role` (revogado de `anon`/`authenticated`).
      Alternativa sem pg_cron: rodar `select public.prune_security_audit_log();` manualmente
      de tempos em tempos.

## Autenticação (Supabase)

- [ ] Habilitar **MFA TOTP** — Painel Supabase → Authentication → configuração de MFA.
      Sem isso, o card "Verificação em duas etapas" em Configurações › Segurança mostra erro
      ao tentar ativar.

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

Nunca commitar valores. Localmente ficam no `.env` (que está no `.gitignore`).

- [x] `SECURITY_AUDIT_IP_SALT` — string aleatória longa (32+ bytes hex). Já definida no `.env`
      local; **copiar o mesmo valor para a Vercel**. Não rotacionar sem migração (invalida a
      correlação de hashes antigos).
      Gerar um novo, se necessário:
      `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [x] `STRIPE_SECRET_KEY` — chave secreta da Stripe (dashboard → Developers → API keys).
      Server-side apenas. Necessária para o onboarding Connect (`api/stripe/connect/*`).
- [x] Aplicar a migration `supabase/migrations/20260903110000_stripe_connect_foundation.sql`.
- [ ] `PAYMENT_WEBHOOK_SECRET` — segredo de assinatura de webhook do processador. Quando
      adicionar webhooks da Stripe, usar o *signing secret* do endpoint (dashboard → Webhooks).
      Enquanto vazio, `/api/payments/webhook` responde `503 PAYMENT_WEBHOOK_NOT_CONFIGURED`
      (comportamento correto).
- [ ] `PAYMENT_WEBHOOK_SECRET_PREVIOUS` — vazio. Só usado durante a rotação do segredo acima
      (procedimento em `docs/SECURITY.md` §9).
- [ ] `PAYMENT_WEBHOOK_IP_ALLOWLIST` — opcional, vazio. CSV dos IPs de origem que o parceiro
      publicar. Vazio = sem restrição de IP.

## E-mails internos (Resend → Edge Function `team-notify`)

Avisos para a equipe quando uma conta conclui o questionário inicial e quando um cadastro de
verificação (KYC) é enviado. O domínio `sphexpay.com.br` já está verificado na Resend (DNS na
Vercel: `resend._domainkey`, `send`, `rsend`). Configurar em Supabase → Edge Functions → Secrets:

- [ ] `RESEND_API_KEY` — chave da Resend com permissão *Sending access* restrita a `sphexpay.com.br`.
- [ ] `TEAM_NOTIFY_EMAIL` — e-mail(s) da equipe que recebem os avisos (separados por vírgula).
- [ ] `TEAM_NOTIFY_FROM` — opcional; padrão `SphexPay <notificacoes@sphexpay.com.br>`.

Enquanto faltar segredo, a função responde `503 NOTIFY_NOT_CONFIGURED` e o cadastro segue normal
(o aviso nunca bloqueia o usuário). O e-mail de KYC não leva CPF/CNPJ, nascimento, endereço nem
documentos — só nome, tipo de pessoa, quantidade de documentos e o link da fila.

## Antes de produção (pagamentos reais)

- [x] CSP bloqueante (`Content-Security-Policy`) em todo o site, sem `unsafe-eval` (zod em modo
      `jitless`). Verificado sem violações nas páginas públicas e no checkout em 21/10/2026.
- [ ] Stripe → Webhooks → endpoint das contas conectadas (`/api/payments/webhook`): incluir os
      eventos `payment_intent.processing`, `payment_intent.canceled`,
      `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
      `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated` e
      `customer.subscription.deleted` (Pix, boleto e assinaturas dependem deles).
- [ ] Concluir a ativação do Stripe Connect da plataforma e só então definir
      `STRIPE_LIVE_PAYMENTS_ENABLED=true`, depois de uma compra real de teste reembolsada.
- [ ] Tornar MFA obrigatório para contas com papel `admin`.
- [x] `npm audit fix` + revalidar `npm run test` / `npm run build`.
- [ ] Obter o AOC (Attestation of Compliance) PCI do parceiro processador.
- [ ] Confirmar com o adquirente qual SAQ se aplica e preencher a SAQ-A oficial.
- [ ] Pentest externo.
- [ ] Ver a lista completa em `docs/PCI-DSS-SAQ-A.md` §4.
