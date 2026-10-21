// Avisos por e-mail via Resend: para a equipe SphexPay e para o próprio usuário.
//
// Eventos: 'onboarding' (questionário inicial concluído → aviso à equipe + boas-vindas ao
// usuário) e 'kyc_submitted' (verificação enviada → aviso à equipe + confirmação de
// recebimento ao usuário). O usuário autenticado só dispara avisos sobre a própria conta,
// e cada e-mail é enviado uma única vez (tabela team_notifications).
// O e-mail de KYC é mínimo: nada de CPF/CNPJ, nascimento, endereço ou documentos — esses
// ficam apenas na fila de verificação (/app/verificacao). Ver docs/DATA-CLASSIFICATION.md.
//
// Segredos: RESEND_API_KEY, TEAM_NOTIFY_EMAIL (um ou mais e-mails separados por vírgula),
// TEAM_NOTIFY_FROM opcional (padrão: SphexPay <notificacoes@sphexpay.com.br>).

import {createClient} from 'npm:@supabase/supabase-js@2'
import {escapeHtml as escapeEmail,renderEmail,EMAIL_SITE} from '../_shared/emailLayout.ts'

const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
const json=(body:Record<string,unknown>,status=200)=>Response.json(body,{status,headers:corsHeaders})
const APP_URL='https://www.sphexpay.com.br'

const LABELS:Record<string,Record<string,string>>={
 business_type:{infoprodutos:'Infoprodutos',loja_virtual:'Loja virtual',dropshipping:'Dropshipping',nutra:'Nutra / Suplementos',saas:'SaaS / Software',servicos:'Serviços',produtos_fisicos:'Produtos físicos',comecando:'Ainda estou começando'},
 segment:{saude:'Saúde e bem-estar',renda_extra:'Renda extra',relacionamento:'Relacionamento',desenvolvimento_pessoal:'Desenvolvimento pessoal',beleza:'Beleza e estética',financas:'Finanças',tecnologia:'Tecnologia',educacao:'Educação',outros:'Outros'},
 monthly_revenue:{sem_faturamento:'Ainda não fatura',ate_10k:'Até R$ 10 mil','10k_50k':'De R$ 10 mil a R$ 50 mil','50k_100k':'De R$ 50 mil a R$ 100 mil','100k_500k':'De R$ 100 mil a R$ 500 mil',acima_500k:'Acima de R$ 500 mil'},
 goal:{comecar_a_vender:'Começar a vender',migrar_plataforma:'Migrar de outra plataforma',aumentar_conversao:'Aumentar a conversão',vender_exterior:'Vender para o exterior',gestao_financeira:'Organizar a gestão financeira',outro:'Outro'},
 acquisition_channel:{instagram:'Instagram',google:'Google',youtube:'YouTube',facebook:'Facebook',indicacao:'Indicação',comunidade_evento:'Comunidade / Evento',outro:'Outro'}
}
const PERSON_TYPE:Record<string,string>={individual:'Pessoa física',company:'Pessoa jurídica'}

const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))
const label=(group:string,value:unknown)=>LABELS[group]?.[String(value)]??String(value??'—')
const dateBR=(iso:unknown)=>{const date=new Date(String(iso));return Number.isNaN(date.getTime())?'—':date.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}

function emailHtml(title:string,intro:string,rows:[string,string][],cta?:{label:string;href:string}){
 const body=rows.map(([key,value])=>`<tr><td style="padding:10px 0;border-bottom:1px solid #e8e8e8;color:#6b6b6b;font-size:13px;width:44%">${escapeHtml(key)}</td><td style="padding:10px 0;border-bottom:1px solid #e8e8e8;color:#111;font-size:14px">${escapeHtml(value)}</td></tr>`).join('')
 const button=cta?`<p style="margin:28px 0 0"><a href="${escapeHtml(cta.href)}" style="display:inline-block;background:#0080ff;color:#fff;text-decoration:none;padding:12px 22px;border-radius:7px;font-size:14px">${escapeHtml(cta.label)}</a></p>`:''
 return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif"><div style="max-width:560px;margin:0 auto;padding:32px 20px"><div style="background:#090909;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;font-size:18px;letter-spacing:-.02em">Sphex<b>Pay</b></div><div style="background:#fff;padding:28px 24px;border-radius:0 0 12px 12px"><h1 style="margin:0 0 8px;font-size:20px;color:#111">${escapeHtml(title)}</h1><p style="margin:0 0 20px;color:#555;font-size:14px;line-height:1.5">${escapeHtml(intro)}</p><table style="width:100%;border-collapse:collapse">${body}</table>${button}</div><p style="color:#999;font-size:11px;text-align:center;margin-top:16px">Aviso interno automático da SphexPay.</p></div></body></html>`
}

Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
 if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405)
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 const resendKey=Deno.env.get('RESEND_API_KEY'),to=(Deno.env.get('TEAM_NOTIFY_EMAIL')||'').split(',').map(item=>item.trim()).filter(Boolean)
 const from=Deno.env.get('TEAM_NOTIFY_FROM')||'SphexPay <notificacoes@sphexpay.com.br>'
 if(!url||!anon||!serviceRole)return json({code:'SERVER_NOT_CONFIGURED'},503)

 const authorization=request.headers.get('Authorization')||''
 const userClient=createClient(url,anon,{global:{headers:{Authorization:authorization}}})
 const {data:{user}}=await userClient.auth.getUser()
 if(!user)return json({code:'UNAUTHORIZED'},401)

 let body:Record<string,unknown>
 try{body=await request.json()}catch{return json({code:'INVALID_PAYLOAD'},400)}
 const event=String(body.event||'')
 if(event!=='onboarding'&&event!=='kyc_submitted')return json({code:'UNKNOWN_EVENT'},400)
 if(!resendKey)return json({code:'NOTIFY_NOT_CONFIGURED'},503)

 const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})
 const meta=user.user_metadata||{}
 const firstName=String(meta.full_name||'').trim().split(/\s+/)[0]
 const account:[string,string][]=[['Nome',String(meta.full_name||'—')],['E-mail',String(user.email||'—')],['Telefone',String(meta.phone||'—')]]

 // Reserva o envio (deduplicação) e envia; se a Resend falhar, libera para nova tentativa.
 const send=async(kind:string,ref:string,recipients:string[],subject:string,html:string)=>{
  if(!recipients.length)return 'skipped'
  const {data:reserved,error:reserveError}=await admin.from('team_notifications').insert({user_id:user.id,kind,ref}).select('id').maybeSingle()
  if(reserveError)return reserveError.code==='23505'?'duplicate':'failed'
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:recipients,subject:subject.replace(/[\r\n\t]+/g,' ').slice(0,180),html})}).catch(()=>null)
  if(!response||!response.ok){await admin.from('team_notifications').delete().eq('id',reserved!.id);return 'failed'}
  return 'sent'
 }
 const userEmail=user.email?[user.email]:[]
 const results:Record<string,string>={}

 if(event==='onboarding'){
  const {data:row,error}=await admin.from('onboarding_responses').select('business_type,segment,monthly_revenue,goal,acquisition_channel,created_at').eq('user_id',user.id).maybeSingle()
  if(error)return json({code:'STORAGE_ERROR'},503)
  if(!row)return json({code:'NOT_FOUND'},404)
  results.team=await send('onboarding','onboarding',to,`Nova conta: ${String(meta.full_name||user.email||'cadastro')}`,emailHtml('Nova conta concluiu o questionário','Uma nova conta respondeu o questionário inicial da SphexPay.',[
   ...account,
   ['Tipo de negócio',label('business_type',row.business_type)],
   ['Segmento',label('segment',row.segment)],
   ['Faturamento mensal',label('monthly_revenue',row.monthly_revenue)],
   ['Objetivo',label('goal',row.goal)],
   ['Como chegou',label('acquisition_channel',row.acquisition_channel)],
   ['Respondido em',dateBR(row.created_at)]
  ]))
  results.user=await send('welcome','welcome',userEmail,firstName?`Boas-vindas à SphexPay, ${firstName}`:'Boas-vindas à SphexPay',renderEmail({
   preheader:'Sua conta SphexPay está pronta. Veja os próximos passos para começar a vender.',
   eyebrow:'Boas-vindas',
   title:firstName?`Que bom ter você aqui, ${escapeEmail(firstName)}.`:'Que bom ter você aqui.',
   paragraphs:['Sua conta SphexPay está criada. A partir de agora, checkout, produtos e acompanhamento de vendas ficam reunidos em um só lugar.','Separamos os próximos passos para você começar com tudo pronto:'],
   button:{label:'Acessar meu painel',href:`${EMAIL_SITE}/app`},
   steps:[
    {title:'Conclua sua verificação',text:'Envie seus dados cadastrais e documentos para liberar recebimentos. A análise é feita pela nossa equipe.'},
    {title:'Configure seus recebimentos',text:'Conecte sua conta de pagamentos no Financeiro para receber pelas suas vendas.'},
    {title:'Crie seu primeiro produto',text:'Cadastre a oferta, personalize o checkout e gere seus links de pagamento.'}
   ],
   reason:'Você recebeu este e-mail porque criou uma conta na SphexPay com este endereço.'
  }))
 }else{
  const {data:profile,error}=await admin.from('kyc_profiles').select('person_type,legal_name,company_name,status,submitted_at').eq('user_id',user.id).maybeSingle()
  if(error)return json({code:'STORAGE_ERROR'},503)
  if(!profile||profile.status!=='pending'||!profile.submitted_at)return json({code:'NOT_SUBMITTED'},409)
  const {count}=await admin.from('kyc_documents').select('id',{count:'exact',head:true}).eq('user_id',user.id)
  const ref=String(profile.submitted_at)
  results.team=await send('kyc_submitted',ref,to,`Verificação enviada: ${String(profile.legal_name||meta.full_name||user.email||'cadastro')}`,emailHtml('Verificação aguardando análise','Um cadastro de verificação foi enviado e está na fila de análise. Dados completos e documentos ficam somente na fila de verificação.',[
   ['Nome legal',String(profile.legal_name||'—')],
   ...(profile.company_name?[['Empresa',String(profile.company_name)] as [string,string]]:[]),
   ['Tipo',PERSON_TYPE[String(profile.person_type)]||String(profile.person_type||'—')],
   ['E-mail da conta',String(user.email||'—')],
   ['Documentos enviados',String(count??0)],
   ['Enviado em',dateBR(profile.submitted_at)]
  ],{label:'Abrir fila de verificação',href:`${APP_URL}/app/verificacao`}))
  results.user=await send('kyc_received',ref,userEmail,'Recebemos sua verificação — SphexPay',renderEmail({
   preheader:'Seus dados e documentos chegaram. Nossa equipe já vai analisar.',
   eyebrow:'Verificação recebida',
   title:'Recebemos seus documentos.',
   paragraphs:[`Sua verificação foi enviada em ${escapeEmail(dateBR(profile.submitted_at))} e está na fila de análise da nossa equipe.`,'Assim que a análise terminar, você recebe o resultado no painel. Se precisarmos de algum ajuste, vamos indicar exatamente o que corrigir.'],
   button:{label:'Acompanhar verificação',href:`${EMAIL_SITE}/app/verificacao`},
   note:'Seus documentos ficam guardados em ambiente privado e são acessados apenas pela equipe de verificação.',
   reason:'Você recebeu este e-mail porque enviou uma verificação de conta na SphexPay.'
  }))
 }

 const failed=Object.values(results).includes('failed')
 return json({ok:!failed,results},failed?502:200)
})
