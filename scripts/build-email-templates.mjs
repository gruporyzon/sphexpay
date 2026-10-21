// Gera os templates de e-mail do Supabase Auth em supabase/templates/ a partir do
// layout único supabase/functions/_shared/emailLayout.ts.
// Uso: node scripts/build-email-templates.mjs
// Depois, copie cada HTML e assunto para Supabase → Authentication → Emails → Templates
// (ou use os caminhos já configurados em supabase/config.toml no ambiente local).
import { mkdirSync,writeFileSync } from 'node:fs'
import { renderEmail,emailText } from '../supabase/functions/_shared/emailLayout.ts'

const reasonAccount='Você recebeu este e-mail porque uma ação foi solicitada na sua conta SphexPay. Se não foi você, ignore esta mensagem.'

export const authTemplates={
 confirmation:{
  subject:'Confirme seu e-mail na SphexPay',
  content:{
   preheader:'Falta um passo: confirme seu e-mail para ativar sua conta SphexPay.',
   eyebrow:'Confirmação de e-mail',
   title:'Sua conta está quase pronta.',
   paragraphs:['Que bom ter você na SphexPay. Para ativar sua conta e continuar o cadastro, confirme que este endereço é seu.','Depois da confirmação, você responde algumas perguntas rápidas sobre o seu negócio e já acessa o painel.'],
   button:{label:'Confirmar meu e-mail',href:'{{ .ConfirmationURL }}'},
   note:'Por segurança, este link expira em breve e só pode ser usado uma vez.',
   fallbackLink:'{{ .ConfirmationURL }}',
   reason:'Você recebeu este e-mail porque uma conta SphexPay foi criada com este endereço. Se não foi você, ignore esta mensagem.'
  }
 },
 recovery:{
  subject:'Redefina sua senha da SphexPay',
  content:{
   preheader:'Recebemos um pedido para redefinir a senha da sua conta SphexPay.',
   eyebrow:'Recuperação de acesso',
   title:'Vamos criar uma nova senha.',
   paragraphs:['Recebemos um pedido para redefinir a senha da sua conta SphexPay. Clique no botão abaixo para escolher uma nova senha.','Se você não pediu a redefinição, pode ignorar este e-mail com tranquilidade: sua senha atual continua valendo.'],
   button:{label:'Redefinir minha senha',href:'{{ .ConfirmationURL }}'},
   note:'O link expira em breve e só pode ser usado uma vez. Nunca compartilhe este e-mail com outras pessoas.',
   fallbackLink:'{{ .ConfirmationURL }}',
   reason:reasonAccount
  }
 },
 magic_link:{
  subject:'Seu link de acesso à SphexPay',
  content:{
   preheader:'Use este link para entrar na sua conta SphexPay sem senha.',
   eyebrow:'Acesso seguro',
   title:'Seu acesso está a um clique.',
   paragraphs:['Use o botão abaixo para entrar na sua conta SphexPay. O link é pessoal e funciona uma única vez.'],
   button:{label:'Entrar na SphexPay',href:'{{ .ConfirmationURL }}'},
   note:'Se você não tentou entrar agora, ignore este e-mail. Ninguém acessa sua conta sem este link.',
   fallbackLink:'{{ .ConfirmationURL }}',
   reason:reasonAccount
  }
 },
 email_change:{
  subject:'Confirme a troca de e-mail da sua conta SphexPay',
  content:{
   preheader:'Confirme o novo endereço de e-mail da sua conta SphexPay.',
   eyebrow:'Alteração de e-mail',
   title:'Confirme seu novo e-mail.',
   paragraphs:['Recebemos um pedido para alterar o e-mail da sua conta SphexPay de <b style="color:#f4f4f4">{{ .Email }}</b> para <b style="color:#f4f4f4">{{ .NewEmail }}</b>.','Confirme a alteração para que os próximos acessos e avisos usem o novo endereço.'],
   button:{label:'Confirmar alteração',href:'{{ .ConfirmationURL }}'},
   note:'Se você não pediu esta alteração, não clique no botão e troque sua senha pelo painel.',
   fallbackLink:'{{ .ConfirmationURL }}',
   reason:reasonAccount
  }
 },
 invite:{
  subject:'Você foi convidado para a SphexPay',
  content:{
   preheader:'Você recebeu um convite para acessar a SphexPay.',
   eyebrow:'Convite',
   title:'Você foi convidado para a SphexPay.',
   paragraphs:['Uma conta foi preparada para você na SphexPay, a plataforma que reúne checkout, produtos e acompanhamento de vendas em um só lugar.','Aceite o convite para criar sua senha e acessar o painel.'],
   button:{label:'Aceitar convite',href:'{{ .ConfirmationURL }}'},
   fallbackLink:'{{ .ConfirmationURL }}',
   reason:'Você recebeu este e-mail porque alguém convidou este endereço para a SphexPay. Se não reconhece o convite, ignore esta mensagem.'
  }
 },
 reauthentication:{
  subject:'Seu código de segurança SphexPay',
  content:{
   preheader:'Use este código para confirmar uma ação sensível na sua conta SphexPay.',
   eyebrow:'Confirmação de segurança',
   title:'Confirme que é você.',
   paragraphs:['Para concluir uma ação sensível na sua conta, informe o código abaixo na SphexPay.'],
   code:'{{ .Token }}',
   note:'O código expira em poucos minutos. Se você não está realizando nenhuma alteração, troque sua senha.',
   reason:reasonAccount
  }
 }
}

export const securityTemplates=Object.fromEntries([
 ['password_changed','Sua senha foi alterada','A senha da sua conta SphexPay foi alterada. Se reconhece esta ação, nenhuma outra confirmação é necessária.'],
 ['email_changed','Seu e-mail foi alterado','O endereço de e-mail da sua conta SphexPay foi alterado.'],
 ['phone_changed','Seu telefone foi alterado','O número de telefone vinculado à sua conta SphexPay foi alterado.'],
 ['identity_linked','Método de acesso adicionado','Um método de acesso foi vinculado à sua conta SphexPay.'],
 ['identity_unlinked','Método de acesso removido','Um método de acesso foi removido da sua conta SphexPay.'],
 ['mfa_factor_enrolled','Verificação em duas etapas adicionada','Um método de verificação em duas etapas foi adicionado à sua conta SphexPay.'],
 ['mfa_factor_unenrolled','Verificação em duas etapas removida','Um método de verificação em duas etapas foi removido da sua conta SphexPay.']
].map(([name,title,message])=>[name,{subject:`${title} — SphexPay`,content:{preheader:message,eyebrow:'Segurança da conta',title:`${title}.`,paragraphs:[message,'Se você não reconhece esta alteração, acesse a SphexPay pelo endereço oficial, revise sua segurança e entre em contato com o suporte.'],button:{label:'Revisar minha conta',href:'https://www.sphexpay.com.br/app/configuracoes'},note:'Este aviso não solicita senha, código de segurança nem envio de documentos por e-mail.',reason:'Você recebeu este aviso de segurança porque houve uma alteração na sua conta SphexPay.'}}]))
export const allAuthTemplates={...authTemplates,...securityTemplates}

const isMain=import.meta.url===`file://${process.argv[1]}`
if(isMain){
 mkdirSync('supabase/templates',{recursive:true})
 const index=[]
 for(const [name,{subject,content}] of Object.entries(allAuthTemplates)){
  const html=renderEmail(content)
  writeFileSync(`supabase/templates/${name}.html`,html)
  writeFileSync(`supabase/templates/${name}.txt`,emailText(html))
  index.push(`${name}: ${subject} (${(Buffer.byteLength(html)/1024).toFixed(1)} KB)`)
 }
 writeFileSync('supabase/templates/SUBJECTS.md',`# Assuntos dos e-mails de Auth\n\nGerado por \`scripts/build-email-templates.mjs\`. Copie para Supabase → Authentication → Emails → Templates.\n\n${Object.entries(allAuthTemplates).map(([name,{subject}])=>`- **${name}**: ${subject}`).join('\n')}\n`)
 const config={}
 for(const [name,{subject,content}] of Object.entries(allAuthTemplates)){
  const key=name in authTemplates?name:`${name}_notification`
  config[`mailer_subjects_${key}`]=subject
  config[`mailer_templates_${key}_content`]=renderEmail(content)
  if(name in securityTemplates)config[`mailer_notifications_${name}_enabled`]=true
 }
 writeFileSync('supabase/templates/auth-config.json',JSON.stringify(config,null,2)+'\n')
 console.log(index.join('\n'))
}
