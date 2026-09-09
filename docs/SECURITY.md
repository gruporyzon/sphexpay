# Segurança da plataforma SphexPay

Este documento descreve as camadas de segurança do "nosso lado" da SphexPay.

> Aviso: a SphexPay nesta versão é um painel/gateway demonstrativo. Não há custódia,
> liquidação, processamento bancário nem conexão com APIs financeiras reais. Quando um
> parceiro processador for integrado, o processamento de cartão ocorre inteiramente no
> ambiente dele (redirect/iframe hospedado). Este documento cobre autenticação, backend
> serverless e banco de dados sob nosso controle.

## 1. Camadas

| Camada | Tecnologia | Controle principal |
| --- | --- | --- |
| Transporte | Vercel (HTTPS obrigatório) | HSTS, cabeçalhos de segurança (`vercel.json`) |
| Autenticação | Supabase Auth | E-mail/senha + Google OAuth, verificação de e-mail, MFA TOTP |
| Backend serverless | Funções Vercel (`api/*`) | Bearer token Supabase, rate limiting, verificação de assinatura de webhook |
| Dados | Postgres/Supabase | RLS forçada, GRANTs mínimos, funções `SECURITY DEFINER` com `search_path` fixo |
| Auditoria | `public.security_audit_log` | Trilha append-only de eventos de segurança |

## 2. Fluxo de um pagamento confirmado

```
Comprador
  -> Checkout hospedado pelo parceiro processador (dados de cartão nunca tocam a SphexPay)
  -> Parceiro processa e confirma o pagamento
  -> Webhook assinado  POST /api/payments/webhook
       . valida IP (allowlist opcional)
       . valida header x-sphexpay-timestamp (tolerância 300s, anti-replay)
       . valida HMAC-SHA256 de "<timestamp>.<corpo bruto>" (segredo atual + anterior)
  -> server/payments/process-payment-event.js  ->  RPC process_payment_event (idempotente)
  -> payment_transactions / payment_transaction_events (RLS: dono lê; escrita só service_role)
  -> financial_event_outbox  ->  Web Push (falha de push nunca reverte o financeiro)
  -> Dashboard do vendedor (SELECT via RLS)
```

## 3. Cabeçalhos HTTP (`vercel.json`)

Aplicados a todas as rotas: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy` (nega câmera, geolocalização,
pagamento, USB; microfone só `self` para o assistente de voz).

A **CSP** está publicada em `Content-Security-Policy-Report-Only` para validação. Depois de
confirmar que não há violações legítimas no app rodando (Vite/Tailwind/Supabase/Recharts),
promover para `Content-Security-Policy` (enforcing) e ajustar `connect-src` com a URL exata do
projeto Supabase. `connect-src` também libera `https://viacep.com.br` (consulta de CEP no
cadastro/KYC — só leitura de endereço público, sem dado sensível).

Rotas `/api/*` recebem ainda `Cache-Control: no-store` e `X-Robots-Tag: noindex`.

## 4. Autenticação e verificação em duas etapas (MFA)

- Provedor: Supabase Auth. Somente a chave publicável (anon) vai ao frontend; `service_role`
  é exclusiva do backend.
- MFA TOTP nativo do Supabase. Ativação em **Configurações › Segurança**
  (`src/components/settings/TwoFactorCard.tsx`). Requer habilitar MFA TOTP no painel do
  Supabase (Authentication › Providers/MFA) — sem variável de ambiente adicional.
- No login, se a conta tem MFA ativo a sessão volta em `aal1` e o `LoginPage` exige o código
  TOTP antes de navegar (`src/components/auth/TwoFactorChallenge.tsx`).
- Enforcement: `src/routes/RequireAAL2.tsx` protege as rotas mais sensíveis (`/app/saques`,
  `/app/integracoes`). Configurações **não** é protegida (é onde o MFA é gerenciado) para
  evitar lockout.
- Contas sem MFA não são bloqueadas — o enforcement se aplica a quem optou pelo segundo fator.

## 5. Rate limiting

`server/security/rateLimit.js` — janela deslizante em memória por chave (userId/IP).
Limites atuais: `/api/push/send` 60/min por usuário; `/api/notifications/generate` 8/min por
usuário.

> Limitação: o estado é por instância da função serverless. Sob escala horizontal o limite é
> aproximado. Produção deve migrar para um store compartilhado (Upstash Redis / Vercel KV)
> mantendo a mesma interface.

## 6. Verificação de webhook

`api/payments/webhook.js`:
- Corpo bruto (`bodyParser` desligado) para HMAC byte a byte.
- Header `x-sphexpay-timestamp` obrigatório; rejeita fora de 300s (anti-replay).
- Assinatura `x-sphexpay-signature` = HMAC-SHA256 de `"<timestamp>.<corpo>"`.
- Rotação de segredo: aceita `PAYMENT_WEBHOOK_SECRET` e `PAYMENT_WEBHOOK_SECRET_PREVIOUS`.
- Allowlist de IP opcional (`PAYMENT_WEBHOOK_IP_ALLOWLIST`).
- Toda tentativa (aceita/rejeitada) é registrada em `security_audit_log` sem PII do corpo.
- Idempotência garantida pela RPC `process_payment_event` + `payment_transaction_events`.

> Nota de integração: `server/security/rawBody.js` lê o corpo do stream quando disponível e
> cai para `JSON.stringify` caso o runtime já tenha consumido o corpo. Ao integrar o parceiro
> real, confirmar que a função da Vercel entrega o corpo **bruto** (pode exigir `micro`/
> `buffer()` ou runtime edge) antes de depender da verificação de assinatura em produção.

## 7. Banco de dados

- RLS habilitada **e forçada** (`force row level security`) nas tabelas financeiras/negócio,
  o que impede bypass mesmo por roles com privilégio de owner.
- `anon` sem acesso a tabelas de negócio.
- `authenticated` recebe apenas DML necessário; tabelas de log de transação são somente
  leitura para o frontend (escrita apenas via `service_role`/RPC).
- Funções `SECURITY DEFINER` com `set search_path` fixo.
- Papel `admin`: via `auth.jwt() -> app_metadata -> role = 'admin'`, concedido manualmente
  (`supabase/promote_dashboard_admin.sql`). Usado por `is_dashboard_admin()`.

## 8. Trilha de auditoria (`public.security_audit_log`)

Append-only. `authenticated` lê só as próprias linhas; escrita apenas por `service_role`.
Nunca armazena PAN, CVV, PII do comprador nem IP em claro (apenas `sha256(salt + ip)`).

Eventos registrados: `mfa.enrolled`, `mfa.unenrolled`, `mfa.challenge_succeeded`,
`mfa.challenge_failed`, `webhook.accepted`, `webhook.rejected`, `kyc.submitted`,
`kyc.document_reviewed`, `kyc.profile_reviewed`.

RPC `record_security_event(p_event_type, p_metadata)` — usada pelo frontend para eventos do
próprio usuário. Retenção: 400 dias via `prune_security_audit_log()` — agendar com pg_cron ou
rotina externa (passo operacional, não incluído nas migrations).

## 9. Módulo de verificação (KYC — documentos do merchant)

Fluxo de cadastro e envio de documentos para compliance (`/app/verificacao`).

- **Tabelas:** `public.kyc_profiles` (1 por merchant) e `public.kyc_documents` (metadados;
  o binário nunca fica em tabela). RLS habilitada e forçada; `anon` sem acesso.
- **Bucket privado `kyc-documents`** (`public = false`, mime `image/jpeg|image/png|application/pdf`,
  limite 10 MB). Policies em `storage.objects`: dono lê/escreve apenas a própria pasta
  (`<user_id>/...`); admin lê tudo. Sem leitura pública.
- **Upload:** Edge Function `kyc-document-upload` — valida tamanho, mime declarado, extensão e a
  **assinatura real dos bytes** (validador embutido na função) antes de gravar com
  `service_role`. Recusa arquivo cujo conteúdo não corresponde ao formato.
- **Transição de status:** o merchant só chega a `pending` pela RPC `public.kyc_submit()`
  (`SECURITY DEFINER`, valida campos e documentos obrigatórios). Um trigger
  (`kyc_profiles_guard`) impede o cliente de definir `approved`/`rejected`/`needs_more_info`
  ou de alterar colunas de análise.
- **Análise:** Edge Function `kyc-review` (ações `list` / `detail` / `review`) — exige
  usuário autenticado com `app_metadata.role === 'admin'`. Endpoint único porque o plano
  Vercel Hobby limita as funções em `api/`. A leitura dos arquivos pelo analista é sempre
  por **URL assinada de 300 s** gerada com `service_role`; o binário não passa pelo backend.
- **Auditoria:** `kyc.submitted`, `kyc.document_reviewed`, `kyc.profile_reviewed` em
  `security_audit_log`.
- Classificação dos dados: ver `docs/DATA-CLASSIFICATION.md`.

## 10. Inventário de segredos

| Segredo | Onde vive | Acesso | Rotação |
| --- | --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Env da Vercel (server) | Backend serverless | Trimestral + on-incident |
| `VAPID_PRIVATE_KEY` | Env da Vercel (server) | `server/push/*` | Anual + on-incident (revoga todas as subscriptions) |
| `PAYMENT_WEBHOOK_SECRET` / `_PREVIOUS` | Env da Vercel (server) + painel do parceiro | Webhook | Trimestral, com janela usando `_PREVIOUS` |
| `PAYMENT_WEBHOOK_IP_ALLOWLIST` | Env da Vercel (server) | Webhook | Conforme o parceiro publicar IPs |
| `OPENAI_API_KEY` | Env da Vercel (server) | `server/notifications/*` | Trimestral + on-incident |
| `STRIPE_SECRET_KEY` | Env da Vercel (server) | `server/stripe/*` | Rotacionar no dashboard da Stripe + on-incident. Nunca no frontend. |
| `SECURITY_AUDIT_IP_SALT` | Env da Vercel (server) | `server/security/auditLog.js` | Não rotacionar sem migração (invalida correlação de hashes antigos) |

Regras: nunca no frontend, nunca no repositório (`.env` e `.env.*` estão no `.gitignore`;
`.env.example` só tem placeholders). Chaves `VITE_*` são públicas por definição — só a URL e a
chave publicável do Supabase.

### Procedimento de rotação de `PAYMENT_WEBHOOK_SECRET`

1. Gerar novo segredo. Definir `PAYMENT_WEBHOOK_SECRET_PREVIOUS` = valor atual.
2. Definir `PAYMENT_WEBHOOK_SECRET` = novo valor. Deploy.
3. Atualizar o segredo no painel do parceiro processador.
4. Após confirmar que os webhooks chegam assinados com o novo segredo, remover
   `PAYMENT_WEBHOOK_SECRET_PREVIOUS`. Deploy.

## 11. Resposta a incidentes (mínimo)

1. Rotacionar o segredo comprometido (ver inventário).
2. Revogar sessões pelo painel do Supabase (Authentication › Users) e/ou forçar re-login.
3. Se envolver o parceiro processador: acionar o contato de segurança dele e invalidar as
   credenciais de integração.
4. Consultar `security_audit_log` e os logs da Vercel para escopo temporal.
5. Comunicar as partes afetadas conforme a LGPD, se houver dado pessoal envolvido.

## 12. Dependências

Rodar `npm audit` a cada release. Vulnerabilidades altas/críticas com correção não-breaking
devem ser aplicadas antes do deploy. Registrar exceções aqui com justificativa e prazo.

Estado em 2026-09-08 (`npm audit --omit=dev`): 4 avisos (1 moderado `postcss`, 3 altos
`react-router`/`react-router-dom` 7.12–7.18). Todos com correção via `npm audit fix` dentro
do range 7.x (não-breaking). O aviso `react-router` (GHSA-qwww-vcr4-c8h2) afeta apenas o
**RSC Mode**, que esta aplicação não usa (SPA Vite com `BrowserRouter`). Ação: aplicar
`npm audit fix` na próxima janela de manutenção e revalidar `npm run test`/`build`.

## 13. Verificação

Ver a seção "Verificação" do plano de segurança e os testes:
`src/test/securityHeaders.test.ts`, `src/test/webhookSecurity.test.ts`,
`src/test/securityHardeningMigration.test.ts`, `src/test/twoFactor.test.tsx`,
`supabase/tests/security_hardening_rls.sql`.
