# E-mails da SphexPay

Todos os e-mails usam o mesmo layout, no visual do gateway: fundo escuro, faixa azul, logo e
botão `#0080ff`. O layout fica em `supabase/functions/_shared/emailLayout.ts`.

| E-mail | Quem envia | Quando |
| --- | --- | --- |
| Confirmação de e-mail | Supabase Auth | Ao criar a conta |
| Recuperação de senha | Supabase Auth | "Esqueci minha senha" |
| Link de acesso | Supabase Auth | Login por link (se habilitado) |
| Troca de e-mail | Supabase Auth | Alteração do e-mail da conta |
| Convite | Supabase Auth | Convite feito pelo painel do Supabase |
| Código de segurança | Supabase Auth | Reautenticação em ações sensíveis |
| Boas-vindas | Edge Function `team-notify` (Resend) | Ao concluir o questionário inicial |
| Verificação recebida | Edge Function `team-notify` (Resend) | Ao enviar a verificação (KYC) |

## Gerar os templates de Auth

```bash
node scripts/build-email-templates.mjs
```

Gera `supabase/templates/*.html` e `supabase/templates/SUBJECTS.md`. O teste
`src/test/emailTemplates.test.ts` falha se os arquivos ficarem desatualizados.

## Ativar no Supabase (produção)

1. Supabase → **Authentication → Emails → Templates**.
2. Para cada template (Confirm signup, Reset password, Magic link, Change email address,
   Invite user, Reauthentication), cole o assunto de `supabase/templates/SUBJECTS.md` e o HTML
   do arquivo correspondente:
   - Confirm signup → `confirmation.html`
   - Reset password → `recovery.html`
   - Magic link → `magic_link.html`
   - Change email address → `email_change.html`
   - Invite user → `invite.html`
   - Reauthentication → `reauthentication.html`
3. Salve cada um.

## Remetente com a marca (SMTP pela Resend)

Sem SMTP próprio, o Supabase envia como "Supabase Auth" e tem limite baixo de envios por hora.
Em Supabase → **Authentication → Emails → SMTP Settings**, habilite o SMTP personalizado:

- Sender email: `nao-responda@sphexpay.com.br`
- Sender name: `SphexPay`
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: uma chave de API da Resend com *Sending access* para `sphexpay.com.br`

O domínio `sphexpay.com.br` já está verificado na Resend (DNS na Vercel).

## Boas-vindas e verificação recebida

Saem pela Edge Function `team-notify`, que já está publicada. Ela precisa do segredo
`RESEND_API_KEY` (Supabase → Edge Functions → Secrets). Cada e-mail é enviado uma única vez
por conta (tabela `team_notifications`). O nome do usuário é escapado antes de entrar no HTML.
