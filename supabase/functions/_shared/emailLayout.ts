// Layout de e-mail SphexPay — mesmo vocabulário visual do gateway público:
// fundo #090909, cartão #111111, azul #0080ff com borda #60acff, faixa em degradê
// azul (aura) e tipografia sem serifa. HTML em tabelas com estilos inline para
// funcionar em Gmail, Outlook, Apple Mail e clientes móveis.
//
// Usado pela Edge Function team-notify (boas-vindas, verificação recebida) e por
// scripts/build-email-templates.mjs, que gera os templates de Auth do Supabase em
// supabase/templates/. Os templates do Supabase recebem marcadores Go como
// {{ .ConfirmationURL }} — por isso `href` e textos aceitam esses marcadores crus.

export const EMAIL_SITE='https://www.sphexpay.com.br'
const LOGO=`${EMAIL_SITE}/brand/email-logo-white.png`
const FONT="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
const C={bg:'#050505',card:'#111111',cardLine:'#222222',text:'#f4f4f4',muted:'#a0a0a0',faint:'#6f6f6f',blue:'#0080ff',blueLine:'#60acff',soft:'#0b1a33'}

export type EmailContent={
 preheader:string
 eyebrow:string
 title:string
 paragraphs:string[]
 button?:{label:string;href:string}
 code?:string
 steps?:{title:string;text:string}[]
 note?:string
 fallbackLink?:string
 reason:string
}

export const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))

function button({label,href}:{label:string;href:string}){
 return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 6px"><tr><td align="center" bgcolor="${C.blue}" style="border-radius:8px;border:1px solid ${C.blueLine};background:${C.blue};box-shadow:inset 0 3px 8px rgba(212,231,255,.55)"><a href="${href}" target="_blank" style="display:inline-block;padding:15px 32px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;letter-spacing:-.01em">${label}&nbsp;&nbsp;&rarr;</a></td></tr></table>`
}

function codeBox(code:string){
 return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 4px"><tr><td align="center" bgcolor="${C.soft}" style="padding:22px 16px;border:1px solid #1d3a66;border-radius:12px;background:${C.soft}"><div style="font-family:${FONT};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${C.blueLine};margin-bottom:8px">Seu código</div><div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:34px;font-weight:600;letter-spacing:.32em;color:#ffffff">${code}</div></td></tr></table>`
}

function stepsList(steps:NonNullable<EmailContent['steps']>){
 const rows=steps.map((step,index)=>`<tr><td valign="top" width="40" style="padding:0 0 16px"><div style="width:28px;height:28px;line-height:28px;border-radius:14px;background:${C.soft};border:1px solid #1d3a66;text-align:center;font-family:${FONT};font-size:12px;font-weight:600;color:${C.blueLine}">${index+1}</div></td><td valign="top" style="padding:3px 0 16px;font-family:${FONT}"><div style="font-size:14px;font-weight:600;color:${C.text};line-height:1.35">${step.title}</div><div style="font-size:13px;color:${C.muted};line-height:1.55;margin-top:2px">${step.text}</div></td></tr>`).join('')
 return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;border-top:1px solid ${C.cardLine};padding-top:22px"><tr><td style="padding-top:22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr></table>`
}

export function renderEmail(content:EmailContent){
 const paragraphs=content.paragraphs.map(text=>`<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">${text}</p>`).join('')
 const note=content.note?`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0"><tr><td style="padding:13px 16px;border:1px solid ${C.cardLine};border-radius:10px;font-family:${FONT};font-size:12.5px;line-height:1.55;color:${C.muted}">${content.note}</td></tr></table>`:''
 const fallback=content.fallbackLink?`<p style="margin:22px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">Se o botão não funcionar, copie e cole este endereço no navegador:<br><a href="${content.fallbackLink}" style="color:${C.blueLine};text-decoration:underline;word-break:break-all">${content.fallbackLink}</a></p>`:''
 return `<!doctype html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${content.title}</title>
<style>
 body{margin:0;padding:0;background:${C.bg}}
 a{color:${C.blueLine}}
 @media (max-width:620px){.spx-card{padding:32px 22px!important}.spx-title{font-size:24px!important}}
</style>
</head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${content.preheader}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg}">
<tr><td align="center" style="padding:36px 14px 40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td align="center" style="padding:0 0 26px">
<a href="${EMAIL_SITE}" target="_blank" style="text-decoration:none"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td valign="middle" style="padding-right:9px"><img src="${LOGO}" width="22" height="32" alt="" style="display:block;border:0;width:22px;height:32px"></td><td valign="middle" style="font-family:${FONT};font-size:24px;letter-spacing:-1px;color:#ffffff;line-height:1">Sphex<b style="font-weight:600">Pay</b></td></tr></table></a>
</td></tr>
<tr><td style="border-radius:18px;overflow:hidden;border:1px solid ${C.cardLine};background:${C.card}" bgcolor="${C.card}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="4" style="height:4px;line-height:4px;font-size:0;background:${C.blue};background-image:linear-gradient(90deg,#1d51ff,#0080ff 55%,#53ddff)" bgcolor="${C.blue}">&nbsp;</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="spx-card" style="padding:40px 40px 38px;background:${C.card};background-image:radial-gradient(ellipse 80% 60% at 85% 0%,rgba(0,128,255,.16),rgba(0,128,255,0) 70%)">
<div style="font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:${C.blue};margin:0 0 12px">${content.eyebrow}</div>
<h1 class="spx-title" style="margin:0 0 16px;font-family:${FONT};font-size:28px;font-weight:600;line-height:1.2;letter-spacing:-.03em;color:${C.text}">${content.title}</h1>
${paragraphs}${content.code?codeBox(content.code):''}${content.button?button(content.button):''}${content.steps?stepsList(content.steps):''}${note}${fallback}
</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:26px 10px 0;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.faint}">
<a href="${EMAIL_SITE}/#ajuda" style="color:${C.muted};text-decoration:none">Central de ajuda</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="${EMAIL_SITE}/termos" style="color:${C.muted};text-decoration:none">Termos de uso</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="${EMAIL_SITE}/privacidade" style="color:${C.muted};text-decoration:none">Privacidade</a><br>
<span style="display:inline-block;margin-top:10px">${content.reason}</span><br>
<span>A SphexPay nunca pede sua senha por e-mail, telefone ou mensagem.</span><br>
<span style="display:inline-block;margin-top:10px;color:#4d4d4d">© SphexPay · sphexpay.com.br</span>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
