# Checklist de ativação da segurança

Passos que dependem de painéis externos (Supabase, Vercel) e não entram no código.
Marcar conforme concluir. Detalhes e justificativas em `docs/SECURITY.md`.

## Banco de dados (Supabase)

- [x] Aplicar migration `supabase/migrations/20260908120000_security_hardening.sql`
      (cria `security_audit_log`, RPC `record_security_event`, força RLS, reduz GRANTs).
- [ ] Habilitar extensão **`pg_cron`** — Painel Supabase → Database → Extensions → `pg_cron` → Enable.
- [ ] Depois de habilitar, agendar a limpeza do log de auditoria (retenção 400 dias):
      ```sql
      select cron.schedule('prune-security-audit','0 3 * * 0',
        $$select public.prune_security_audit_log()$$);
      ```
      Alternativa sem pg_cron: rodar `select public.prune_security_audit_log();` manualmente
      de tempos em tempos.

## Autenticação (Supabase)

- [ ] Habilitar **MFA TOTP** — Painel Supabase → Authentication → configuração de MFA.
      Sem isso, o card "Verificação em duas etapas" em Configurações › Segurança mostra erro
      ao tentar ativar.

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

Nunca commitar valores. Localmente ficam no `.env` (que está no `.gitignore`).

- [ ] `SECURITY_AUDIT_IP_SALT` — string aleatória longa (32+ bytes hex). Já definida no `.env`
      local; **copiar o mesmo valor para a Vercel**. Não rotacionar sem migração (invalida a
      correlação de hashes antigos).
      Gerar um novo, se necessário:
      `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] `STRIPE_SECRET_KEY` — chave secreta da Stripe (dashboard → Developers → API keys).
      Server-side apenas. Necessária para o onboarding Connect (`api/stripe/connect/*`).
- [ ] Aplicar a migration `supabase/migrations/20260903110000_stripe_connect_foundation.sql`.
- [ ] `PAYMENT_WEBHOOK_SECRET` — segredo de assinatura de webhook do processador. Quando
      adicionar webhooks da Stripe, usar o *signing secret* do endpoint (dashboard → Webhooks).
      Enquanto vazio, `/api/payments/webhook` responde `503 PAYMENT_WEBHOOK_NOT_CONFIGURED`
      (comportamento correto).
- [ ] `PAYMENT_WEBHOOK_SECRET_PREVIOUS` — vazio. Só usado durante a rotação do segredo acima
      (procedimento em `docs/SECURITY.md` §9).
- [ ] `PAYMENT_WEBHOOK_IP_ALLOWLIST` — opcional, vazio. CSV dos IPs de origem que o parceiro
      publicar. Vazio = sem restrição de IP.

## Antes de produção (pagamentos reais)

- [ ] Promover a CSP de `Content-Security-Policy-Report-Only` para `Content-Security-Policy`
      em `vercel.json`, após confirmar zero violações legítimas no app rodando. Ajustar
      `connect-src` com a URL exata do projeto Supabase.
- [ ] Tornar MFA obrigatório para contas com papel `admin`.
- [ ] `npm audit fix` + revalidar `npm run test` / `npm run build`.
- [ ] Obter o AOC (Attestation of Compliance) PCI do parceiro processador.
- [ ] Confirmar com o adquirente qual SAQ se aplica e preencher a SAQ-A oficial.
- [ ] Pentest externo.
- [ ] Ver a lista completa em `docs/PCI-DSS-SAQ-A.md` §4.
