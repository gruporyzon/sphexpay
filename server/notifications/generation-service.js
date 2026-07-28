import OpenAI from 'openai'

export const DEFAULT_NOTIFICATION_MODEL='gpt-5.6-luna'
export const MAX_REQUEST_LENGTH=1200
export const notificationSuggestionSchema={
 type:'object',
 additionalProperties:false,
 required:['suggestions','recommendedIndex','detectedIntent','warnings'],
 properties:{
  suggestions:{
   type:'array',minItems:3,maxItems:3,
   items:{
    type:'object',additionalProperties:false,
    required:['id','label','title','body','reason'],
    properties:{
     id:{type:'string',minLength:1,maxLength:40},
     label:{type:'string',enum:['Direta','Motivacional','Premium']},
     title:{type:'string',minLength:1,maxLength:60},
     body:{type:'string',minLength:1,maxLength:160},
     reason:{type:'string',minLength:1,maxLength:140}
    }
   }
  },
  recommendedIndex:{type:'integer',minimum:0,maximum:2},
  detectedIntent:{type:'string',minLength:1,maxLength:80},
  warnings:{type:'array',maxItems:5,items:{type:'string',maxLength:120}}
 }
}

const clean=(value,max=240)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):''
const allowed={
 objective:new Set(['Informar','Confirmar','Alertar','Engajar','Recuperar cliente','Incentivar nova compra','Comunicar urgência']),
 tone:new Set(['Profissional','Direto','Motivacional','Premium','Amigável','Urgente','Minimalista']),
 size:new Set(['Curto','Médio','Detalhado']),
 emoji:new Set(['Sem emoji','Discreto','Moderado']),
 audience:new Set(['Administrador','Produtor','Afiliado','Cliente','Todos os dispositivos','Dispositivo atual']),
 currency:new Set(['BRL','USD','EUR']),
 action:new Set(['generate','shorter','professional','persuasive','remove_emojis','similar'])
}
const oneOf=(value,set,fallback)=>set.has(value)?value:fallback

export function sanitizeGenerationInput(input={}){
 const request=clean(input.request,MAX_REQUEST_LENGTH),currentTitle=clean(input.currentTitle,60),currentBody=clean(input.currentBody,160)
 return{
  request,
  action:oneOf(input.action,allowed.action,'generate'),
  objective:oneOf(input.objective,allowed.objective,'Informar'),
  tone:oneOf(input.tone,allowed.tone,'Profissional'),
  size:oneOf(input.size,allowed.size,'Curto'),
  emoji:oneOf(input.emoji,allowed.emoji,'Sem emoji'),
  audience:oneOf(input.audience,allowed.audience,'Produtor'),
  value:clean(input.value,40),
  currency:oneOf(input.currency,allowed.currency,'BRL'),
  customer:clean(input.customer,120),method:clean(input.method,80),
  route:/^\/app(?:\/[A-Za-z0-9_?=&%./-]*)?$/.test(clean(input.route,160))?clean(input.route,160):'/app',
  additional:clean(input.additional,500),currentTitle,currentBody
 }
}

const unresolved=/\{[^}]+\}/
const labels=['Direta','Motivacional','Premium']
export function validateGenerationResult(value){
 if(!value||typeof value!=='object'||!Array.isArray(value.suggestions)||value.suggestions.length!==3)return null
 const suggestions=value.suggestions.map((item,index)=>{
  if(!item||typeof item!=='object')return null
  const title=clean(item.title,60),body=clean(item.body,160),reason=clean(item.reason,140)
  if(!title||!body||!reason||unresolved.test(title)||unresolved.test(body))return null
  return{id:clean(item.id,40)||`suggestion-${index+1}`,label:labels[index],title,body,reason}
 })
 if(suggestions.some(item=>!item))return null
 const recommendedIndex=Number(value.recommendedIndex)
 return{
  suggestions,
  recommendedIndex:Number.isInteger(recommendedIndex)&&recommendedIndex>=0&&recommendedIndex<=2?recommendedIndex:0,
  detectedIntent:clean(value.detectedIntent,80)||'Mensagem personalizada',
  warnings:Array.isArray(value.warnings)?value.warnings.map(item=>clean(item,120)).filter(Boolean).slice(0,5):[]
 }
}

const instructions=`Você escreve notificações Push da SphexPay em português do Brasil.
Retorne exatamente três versões: Direta, Motivacional e Premium.
Use somente fatos fornecidos. Nunca invente produto, cliente, valor, desconto, pagamento ou urgência.
Nunca cite, sugira ou inclua nome de produto. O gerador manual não usa produtos.
Não afirme confirmação financeira se o pedido não disser que ela ocorreu.
Evite spam, promessas, pressão enganosa e urgência falsa.
Respeite título até 60 caracteres e mensagem até 160 caracteres.
Não deixe variáveis, placeholders ou chaves no texto.
O motivo deve explicar brevemente a escolha editorial, sem revelar raciocínio interno.`

const promptFor=input=>JSON.stringify({
 pedido:input.request,ação:input.action,objetivo:input.objective,tom:input.tone,tamanho:input.size,
 emojis:input.emoji,público:input.audience,contexto:{
  valor:input.value||null,moeda:input.currency,
  cliente:input.customer||null,método:input.method||null,rota:input.route,
  informaçõesAdicionais:input.additional||null,títuloAtual:input.currentTitle||null,mensagemAtual:input.currentBody||null
 }
})

export async function generateNotificationSuggestions({input,apiKey=process.env.OPENAI_API_KEY,model=process.env.OPENAI_NOTIFICATION_MODEL||DEFAULT_NOTIFICATION_MODEL,client,timeoutMs=12000}){
 if(!apiKey&&!client)throw Object.assign(new Error('AI_NOT_CONFIGURED'),{code:'AI_NOT_CONFIGURED'})
 const openai=client||new OpenAI({apiKey,maxRetries:0})
 const request={
  model,
  instructions,
  input:promptFor(input),
  max_output_tokens:900,
  text:{format:{type:'json_schema',name:'sphexpay_notification_suggestions',strict:true,schema:notificationSuggestionSchema}}
 }
 let lastError
 for(let attempt=0;attempt<2;attempt++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs)
  try{
   const response=await openai.responses.create({...request,input:attempt===0?request.input:`${request.input}\nA resposta anterior foi inválida. Gere novamente obedecendo estritamente ao schema.`},{signal:controller.signal})
   let parsed
   try{parsed=JSON.parse(response.output_text||'')}catch{parsed=null}
   const valid=validateGenerationResult(parsed)
   if(valid)return{...valid,model}
   lastError=Object.assign(new Error('AI_INVALID_RESPONSE'),{code:'AI_INVALID_RESPONSE'})
  }catch(error){
   if(controller.signal.aborted)throw Object.assign(new Error('AI_TIMEOUT'),{code:'AI_TIMEOUT'})
   lastError=error
   if(attempt===0&&['AI_INVALID_RESPONSE'].includes(error?.code))continue
   if(attempt===0&&error?.status>=500)continue
   break
  }finally{clearTimeout(timer)}
 }
 throw Object.assign(new Error('AI_GENERATION_FAILED'),{code:lastError?.code||'AI_GENERATION_FAILED'})
}
