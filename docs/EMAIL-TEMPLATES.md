# E-mails da SphexPay

Identidade compartilhada com a entrada do gateway: logo branca, cartão escuro,
azul `#0080ff`, faixa azul e tipografia sem serifa. Tabelas e CSS inline, corpo
16 px, botões de pelo menos 44 px, contraste e largura adaptada ao celular.
O layout está em `supabase/functions/_shared/emailLayout.ts`.

| E-mail | Origem | Gatilho |
| --- | --- | --- |
| Confirmação, recuperação, convite, link de acesso, troca de e-mail e código | Supabase Auth | Fluxo correspondente |
| Senha, e-mail ou telefone alterado; método de acesso ou MFA adicionado/removido | Supabase Auth | Aviso de segurança habilitado no projeto |
| Boas-vindas | `team-notify` / Resend | Questionário inicial concluído |
| Documentos recebidos | `team-notify` / Resend | Verificação enviada |
| Documento aprovado ou com ajuste | `kyc-review` / Resend | Decisão da equipe no documento |
| Verificação aprovada, recusada ou com mais informações solicitadas | `kyc-review` / Resend | Decisão da equipe no cadastro |
| Avisos internos de cadastro, verificação e premiação | `team-notify` / Resend | Eventos existentes, com o mesmo layout |

A aprovação de um documento não anuncia aprovação de toda a conta. Motivos da
análise, documentos e URLs assinadas ficam no painel autenticado; não seguem
nos novos e-mails. Não há anexos de KYC nem alterações nas regras de aprovação.

## Gerar e revisar

```bash
node scripts/build-email-templates.mjs
node scripts/email-preview.mjs
npm run typecheck
npm run lint
npm run test -- src/test/emailTemplates.test.ts src/test/kycEmailDelivery.test.ts src/test/kycEmailOutbox.test.ts src/test/kycReviewEmailIntegration.test.ts src/test/awardsNotificationsDatabase.test.ts --maxWorkers=2
QA_BROWSER_PATH=/caminho/do/chromium node scripts/email-qa.mjs
npm run build
```

- `supabase/templates/*.html`: 13 modelos Auth/segurança, mantendo os marcadores Go oficiais.
- `*.txt`: alternativas para revisão. A Resend recebe HTML e texto; no Auth a geração da alternativa MIME depende do Supabase.
- `SUBJECTS.md`: assuntos em português.
- `auth-config.json`: apenas templates, assuntos e flags de avisos de segurança para o PATCH da Management API. Sem SMTP, senhas, provedores ou URLs de redirecionamento.
- `docs/email-preview/index.html`: galeria de 18 exemplos com links/códigos fictícios. Não envia mensagens.
- `docs/email-preview/results.json`: matriz de renderização local. Chromium não comprova fidelidade no Outlook/Gmail/Apple Mail; falta o teste nas caixas reais.

## Ativação de Auth em produção

`supabase/config.toml` configura o ambiente local, **não ativa os modelos no projeto hospedado**.
Em Supabase → Authentication → Emails → Templates, copie cada HTML e o assunto
correspondente. Ative também os sete avisos de segurança. Alternativamente,
aplique `auth-config.json` ao endpoint oficial `PATCH /v1/projects/<ref>/config/auth`
com uma credencial de administração mantida fora do repositório.

Em SMTP Settings, use o provedor já existente e verificado para a SphexPay:

- Sender name: `SphexPay`.
- Sender email: endereço verificado de `sphexpay.com.br`.
- Host `smtp.resend.com`, porta `465`, usuário `resend`.
- Password: chave de envio da Resend restrita ao domínio da SphexPay.

Confirme SPF/DKIM e DMARC no provedor correto. Desative rastreamento de links nos
e-mails de autenticação para preservar os links de uso único. Não substitua
credenciais existentes sem conferir a conta e o domínio.

**Conferência desta atualização:** a conta Resend conectada não lista
`sphexpay.com.br`; portanto a antiga afirmação de que o domínio estava verificado
não foi confirmada. O navegador do Supabase pede login e a solicitação segura foi
recusada. Modelos hospedados/SMTP e entrega real de Auth permanecem sem validação.

## Envio de documentos e retentativas

A migration `20261021045918_branded_kyc_email_outbox.sql` cria uma fila privada.
O trigger grava o evento na mesma transação da decisão, apenas quando o status
muda. Não há disparos retroativos. `anon` e `authenticated` não acessam a fila;
a função de análise continua exigindo `app_metadata.role = admin`.

`kyc-review` tenta enviar em segundo plano após a análise e ao abrir a fila
administrativa. Não atrasa nem reverte uma decisão salva por falha do provedor.
A Resend recebe uma chave idempotente por evento. Eventos superados por uma nova
análise são cancelados. Falhas temporárias ficam pendentes, com espera crescente,
até oito tentativas na janela de 23 horas. Não há novo cron configurado:
retentativas são retomadas nas visitas da equipe ou por uma chamada autenticada
administrativa `{ "action": "dispatch_emails" }` ao endpoint existente. Uma
integração de agendamento futura deve manter essa autorização; nunca expor o
endpoint ou uma chave privilegiada no frontend.

A fila não armazena conteúdo, nomes, e-mails, motivos, CPF/CNPJ ou documentos.
O destino é consultado no Auth no momento do envio. A ação administrativa não
aceita destinatário, HTML ou assunto arbitrários. Envios após a janela devem ser
revisados pela equipe para evitar avisos atrasados ou duplicados.

Ambas as funções precisam de `RESEND_API_KEY`; remetente opcional em
`TEAM_NOTIFY_FROM` (padrão `SphexPay <notificacoes@sphexpay.com.br>`). Avisos internos
mantêm `TEAM_NOTIFY_EMAIL`. Secrets são cadastrados no Supabase, nunca no código.
A entrega real deve ser confirmada no provedor e na caixa de entrada antes de
anunciar que todos os e-mails estão ativos.
