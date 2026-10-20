// Avisos internos para a equipe SphexPay via Resend.
//
// Eventos: 'onboarding' (questionário inicial concluído) e 'kyc_submitted' (cadastro de
// verificação enviado). O usuário autenticado só consegue disparar avisos sobre a própria
// conta, e cada evento é enviado uma única vez (tabela team_notifications).
// O e-mail de KYC é mínimo: nada de CPF/CNPJ, nascimento, endereço ou documentos — esses
// ficam apenas na fila de verificação (/app/verificacao). Ver docs/DATA-CLASSIFICATION.md.
//
// Segredos: RESEND_API_KEY, TEAM_NOTIFY_EMAIL (um ou mais e-mails separados por vírgula),
// TEAM_NOTIFY_FROM opcional (padrão: SphexPay <notificacoes@sphexpay.com.br>).

import {createClient} from 'npm:@supabase/supabase-js@2'

const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
const json=(body:Record<string,unknown>,status=200)=>Response.json(body,{status,headers:corsHeaders})
const APP_URL='https://sphexpay.com.br'

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
 if(!resendKey||!to.length)return json({code:'NOTIFY_NOT_CONFIGURED'},503)

 const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})
 const meta=user.user_metadata||{}
 const account:[string,string][]=[['Nome',String(meta.full_name||'—')],['E-mail',String(user.email||'—')],['Telefone',String(meta.phone||'—')]]
 let ref:string,subject:string,html:string

 if(event==='onboarding'){
  const {data:row,error}=await admin.from('onboarding_responses').select('business_type,segment,monthly_revenue,goal,acquisition_channel,created_at').eq('user_id',user.id).maybeSingle()
  if(error)return json({code:'STORAGE_ERROR'},503)
  if(!row)return json({code:'NOT_FOUND'},404)
  ref='onboarding'
  subject=`Nova conta: ${String(meta.full_name||user.email||'cadastro')}`
  html=emailHtml('Nova conta concluiu o questionário','Uma nova conta respondeu o questionário inicial da SphexPay.',[
   ...account,
   ['Tipo de negócio',label('business_type',row.business_type)],
   ['Segmento',label('segment',row.segment)],
   ['Faturamento mensal',label('monthly_revenue',row.monthly_revenue)],
   ['Objetivo',label('goal',row.goal)],
   ['Como chegou',label('acquisition_channel',row.acquisition_channel)],
   ['Respondido em',dateBR(row.created_at)]
  ])
 }else{
  const {data:profile,error}=await admin.from('kyc_profiles').select('person_type,legal_name,company_name,status,submitted_at').eq('user_id',user.id).maybeSingle()
  if(error)return json({code:'STORAGE_ERROR'},503)
  if(!profile||profile.status!=='pending'||!profile.submitted_at)return json({code:'NOT_SUBMITTED'},409)
  const {count}=await admin.from('kyc_documents').select('id',{count:'exact',head:true}).eq('user_id',user.id)
  ref=String(profile.submitted_at)
  subject=`Verificação enviada: ${String(profile.legal_name||meta.full_name||user.email||'cadastro')}`
  html=emailHtml('Verificação aguardando análise','Um cadastro de verificação foi enviado e está na fila de análise. Dados completos e documentos ficam somente na fila de verificação.',[
   ['Nome legal',String(profile.legal_name||'—')],
   ...(profile.company_name?[['Empresa',String(profile.company_name)] as [string,string]]:[]),
   ['Tipo',PERSON_TYPE[String(profile.person_type)]||String(profile.person_type||'—')],
   ['E-mail da conta',String(user.email||'—')],
   ['Documentos enviados',String(count??0)],
   ['Enviado em',dateBR(profile.submitted_at)]
  ],{label:'Abrir fila de verificação',href:`${APP_URL}/app/verificacao`})
 }

 // Reserva o envio; se já existe, este evento já foi avisado.
 const {data:reserved,error:reserveError}=await admin.from('team_notifications').insert({user_id:user.id,kind:event,ref}).select('id').maybeSingle()
 if(reserveError){
  if(reserveError.code==='23505')return json({ok:true,duplicate:true})
  return json({code:'STORAGE_ERROR'},503)
 }

 subject=subject.replace(/[\r\n\t]+/g,' ').slice(0,180)
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to,subject,html})}).catch(()=>null)
 if(!response||!response.ok){
  await admin.from('team_notifications').delete().eq('id',reserved!.id)
  return json({code:'EMAIL_FAILED'},502)
 }
 return json({ok:true})
})
