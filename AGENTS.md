# Regras permanentes do projeto

- O produto se chama SphexPay.
- A identidade usa branco, preto e laranja.
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

- [ ] Habilitar `pg_cron` no Supabase e agendar `prune_security_audit_log()` (ou rodar manual).
- [ ] Habilitar MFA TOTP no Supabase (Authentication) — sem isso o card de 2FA falha.
- [ ] Copiar `SECURITY_AUDIT_IP_SALT` do `.env` para as variáveis de ambiente da Vercel.
- [ ] `PAYMENT_WEBHOOK_SECRET` só quando integrar um parceiro processador real (fica vazio até lá).
- [ ] Antes de produção: promover CSP de Report-Only para enforcing em `vercel.json`.
