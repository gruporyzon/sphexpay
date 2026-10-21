# Regras permanentes do projeto

- O produto se chama SphexPay.
- A identidade usa preto, branco e azul (`#0080ff`): superfície pública escura com acento azul; painel monocromático com modo claro e escuro — ver `DESIGN.md`.
- O visual deve ser premium, tecnológico e minimalista.
- Nunca usar emojis.
- Utilizar ícones vetoriais profissionais.
- Manter modo claro e escuro completos.
- Não remover funcionalidades existentes sem autorização.
- Não substituir páginas completas quando uma correção localizada for suficiente.
- Sempre preservar responsividade.
- Sempre executar TypeScript, lint e build depois de mudanças relevantes.
- Nunca adicionar chaves, senhas ou tokens ao código.
- Nunca alegar que pagamentos reais funcionam sem integrações oficiais.
- Os valores editáveis atuais são exclusivamente demonstrativos.
- Antes de mudanças grandes, analisar os arquivos existentes.
- Alterações em autenticação, RLS, webhook de pagamento ou segredos exigem revisar `docs/SECURITY.md`.
- Nunca introduzir captura, armazenamento ou trânsito de dados de cartão (PAN, CVV, tarja) — ver `docs/DATA-CLASSIFICATION.md`.

## Pendências de segurança (concluir nos painéis, não no código)

Checklist completo e atualizável em `docs/SECURITY-SETUP.md`. Resumo do que ainda falta:

- [ ] Habilitar MFA TOTP no Supabase (Authentication) — sem isso o card de 2FA falha.
- [ ] `PAYMENT_WEBHOOK_SECRET` só quando integrar um parceiro processador real (fica vazio até lá).
- [ ] Fazer a primeira compra real de teste (valor baixo) e reembolsar — cobranças reais já estão ligadas desde 21/10/2026.
- [ ] Colar os templates de e-mail no Supabase (Authentication → Emails) e configurar o SMTP da Resend — ver `docs/EMAIL-TEMPLATES.md`.
- [ ] Cadastrar `RESEND_API_KEY` e `TEAM_NOTIFY_EMAIL` nos Secrets das Edge Functions do Supabase (avisos internos de novas contas e KYC — ver `docs/SECURITY-SETUP.md`).
- [ ] KYC: definir política de retenção dos documentos antes de produção (migration e Edge Functions já aplicadas).
