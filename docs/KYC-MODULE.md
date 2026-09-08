# Módulo de Verificação / KYC — estado e contexto

> Handoff da implementação feita em 2026-09-08 (sessão Claude Code).
> Objetivo: fluxo de onboarding com upload de documentos (RG/CNH, comprovante de
> endereço, dados da empresa se PJ), validação e status do cadastro
> (pendente / aprovado / reprovado) — base de compliance para liberar o merchant.

## Status

- [x] Código implementado, `typecheck` / `lint` / `build` passando; `src/test/kyc.test.ts` passando.
- [ ] **Migration ainda NÃO aplicada** no projeto Supabase (`dllntqtnmojvphijhuhd`).
- [ ] **Edge Functions ainda NÃO publicadas** (`kyc-document-upload`, `kyc-review`).
- [ ] Usuário admin ainda não promovido (`gruporyzon@gmail.com` → `raw_app_meta_data.role='admin'`).
- [ ] Nada commitado — tudo em working tree.

A suíte de testes completa tem ~49 falhas **pré-existentes** (Node 22 + jsdom/undici,
`TypeError: The "event" argument must be an instance of Event`), sem relação com este módulo —
confirmado rodando a árvore limpa.

## Arquitetura

| Camada | Arquivo |
| --- | --- |
| Schema + RLS + RPC + storage bucket | `supabase/migrations/20260908130000_kyc_onboarding_v1.sql` |
| Upload validado (magic bytes) | `supabase/functions/kyc-document-upload/index.ts` (arquivo único, validador embutido) |
| Fila de análise admin | `supabase/functions/kyc-review/index.ts` (ações `list` / `detail` / `review`) |
| Serviço frontend | `src/features/kyc/kycService.ts` |
| Tipos + constantes (docs obrigatórios, labels) | `src/features/kyc/types.ts` |
| Validação client-side + regras de completude | `src/features/kyc/validation.ts` |
| Página (abas "Meu cadastro" / "Análise (admin)") | `src/features/kyc/KycPage.tsx` |
| Faixa de status no Financeiro | `src/features/kyc/KycStatusNotice.tsx` |
| Estilos | `src/features/kyc/kyc.css` |
| Testes | `src/test/kyc.test.ts` |

Alterados: `src/App.tsx` (lazy route `verificacao`), `src/config/navigation.ts` (item
"Verificação" no grupo Pagamentos), `src/pages/FinancialHub.tsx` (`<KycStatusNotice/>`),
`src/pages/onboarding/OnboardingPage.tsx` (copy da conclusão), `supabase/config.toml`
(`[functions.kyc-document-upload]`, `[functions.kyc-review]`), `docs/SECURITY.md` (§9),
`docs/DATA-CLASSIFICATION.md`, `AGENTS.md`.

## Decisões de projeto

- **Análise admin via Edge Function `kyc-review`**, não via `api/kyc/*` — o plano Vercel Hobby
  limita `api/` a 12 funções (já no limite; `src/test/vercelFunctionLimit.test.ts` garante).
- **Sem bloqueio** de funcionalidades existentes — só exibição de status.
- Upload passa pela Edge Function (service_role) com validação de assinatura de bytes; o
  cliente nunca escreve direto no bucket.
- Transição para `pending` só pela RPC `public.kyc_submit()`. Trigger `kyc_profiles_guard`
  impede o cliente de definir status de análise; admin e `service_role` passam.
- Documentos obrigatórios: PF = `identity_front`,`identity_back`,`proof_of_address`;
  PJ = `company_registration`,`proof_of_address`,`representative_document`.
- Rota única `/app/verificacao`; a aba "Análise (admin)" só aparece com
  `useDashboardAdmin().allowed` (JWT `app_metadata.role === 'admin'`).

## Como colocar no ar

O projeto usa Supabase remoto (ref `dllntqtnmojvphijhuhd`). CLI precisa de
`supabase login` + `supabase link` — ou fazer tudo pelo painel.

### 1. Migration
`SQL Editor` → colar `supabase/migrations/20260908130000_kyc_onboarding_v1.sql` → Run.
Depende de `20260908120000_security_hardening.sql` (cria `is_dashboard_admin()` e
`security_audit_log`).
Verificar: tabelas `kyc_profiles` / `kyc_documents`; bucket `kyc-documents` (privado).

### 2. Edge Functions (painel)
Edge Functions → *Create a new function* → apagar o template → colar o `index.ts` → Deploy.
Nomes exatos: `kyc-document-upload` e `kyc-review`. Env vars são automáticas.

### 3. Admin
```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"role":"admin"}'::jsonb
where lower(email) = lower('gruporyzon@gmail.com');
```
Depois logout/login.

### 4. Testar (`npm run dev` → http://localhost:4175)
- `/app/verificacao` → "Meu cadastro": Pessoa física → nome + CPF (11 díg.) + endereço →
  **Salvar dados** → subir os 3 documentos → **Enviar para análise** (status → "Em análise").
- Conta admin → aba "Análise (admin)" → abrir submissão → aprovar documentos → **Aprovar cadastro**.
- Merchant volta a `/app/financeiro` → aviso some quando "Aprovado".
- Conferir no banco: `kyc_profiles`, `kyc_documents`, `storage/kyc-documents/<user_id>/…`,
  `security_audit_log` (`kyc.submitted`, `kyc.profile_reviewed`).

O front já traduz os códigos de erro da função (ex.: "as tabelas ainda não foram criadas",
"a função não foi publicada", "preencha e salve seus dados antes").

## Pendências / próximos passos

- Aplicar migration + publicar functions + promover admin (acima).
- Definir política de **retenção** dos documentos antes de produção (hoje sem expurgo).
- Opcional: gate real (ex.: bloquear saques enquanto `status != 'approved'`) — hoje só exibe.
- Opcional: notificação ao merchant quando o cadastro é aprovado/reprovado
  (há `financial_event_outbox` + push; não integrado ao KYC).
- Commitar as mudanças.
