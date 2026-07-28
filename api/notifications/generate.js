import {createHash} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {generateNotificationSuggestions,MAX_REQUEST_LENGTH,sanitizeGenerationInput} from './generation-service.js'
import {serviceRoleKey,supabaseUrl} from '../push/config.js'

const windows=new Map(),cache=new Map()
const clean=value=>typeof value==='string'?value.trim():''
const fail=(response,status,code,message)=>response.status(status).json({success:false,code,message})
const allow=userId=>{
 const now=Date.now(),recent=(windows.get(userId)||[]).filter(value=>value>now-60_000)
 if(recent.length>=8)return false
 recent.push(now);windows.set(userId,recent);return true
}
const cacheKey=(userId,input)=>createHash('sha256').update(`${userId}:${JSON.stringify(input)}`).digest('hex')
export const resetNotificationGenerationState=()=>{windows.clear();cache.clear()}

export default async function handler(request,response){
 if(request.method!=='POST')return fail(response,405,'METHOD_NOT_ALLOWED','Método não permitido.')
 if(!process.env.OPENAI_API_KEY)return fail(response,503,'AI_NOT_CONFIGURED','A criação com IA ainda não está configurada.')
 if(!supabaseUrl()||!serviceRoleKey())return fail(response,503,'AUTH_UNAVAILABLE','Não foi possível validar sua sessão.')
 const token=clean(String(request.headers?.authorization||'').replace(/^Bearer\s+/i,''))
 if(!token)return fail(response,401,'UNAUTHORIZED','Sua sessão expirou. Entre novamente.')
 const auth=createClient(supabaseUrl(),serviceRoleKey(),{auth:{persistSession:false,autoRefreshToken:false}})
 const {data:{user},error}=await auth.auth.getUser(token)
 if(error||!user)return fail(response,401,'UNAUTHORIZED','Sua sessão expirou. Entre novamente.')
 if(!allow(user.id))return fail(response,429,'AI_RATE_LIMITED','Limite de criações atingido. Aguarde um minuto.')
 let raw
 try{raw=typeof request.body==='string'?JSON.parse(request.body):request.body||{}}catch{return fail(response,400,'INVALID_PAYLOAD','Não foi possível entender o pedido.')}
 if(typeof raw.request!=='string'||!raw.request.trim())return fail(response,400,'REQUEST_REQUIRED','Explique o que deseja comunicar.')
 if(raw.request.length>MAX_REQUEST_LENGTH)return fail(response,413,'REQUEST_TOO_LONG',`O pedido deve ter até ${MAX_REQUEST_LENGTH} caracteres.`)
 const input=sanitizeGenerationInput(raw),key=cacheKey(user.id,input),cached=cache.get(key)
 if(cached&&cached.expiresAt>Date.now())return response.status(200).json({success:true,...cached.value,cached:true})
 try{
  const generated=await generateNotificationSuggestions({input})
  const value={suggestions:generated.suggestions,recommendedIndex:generated.recommendedIndex,detectedIntent:generated.detectedIntent,warnings:generated.warnings}
  cache.set(key,{value,expiresAt:Date.now()+120_000})
  console.info('[NOTIFICATION_AI]',JSON.stringify({userIdHash:createHash('sha256').update(user.id).digest('hex').slice(0,12),model:generated.model,action:input.action,suggestions:value.suggestions.length}))
  return response.status(200).json({success:true,...value})
 }catch(generationError){
  const code=generationError?.code
  if(code==='AI_TIMEOUT')return fail(response,504,code,'A criação demorou mais que o esperado. Tente novamente.')
  if(code==='AI_INVALID_RESPONSE')return fail(response,502,code,'A IA não retornou sugestões válidas. Tente novamente.')
  return fail(response,502,'AI_GENERATION_FAILED','Não foi possível criar sugestões agora. Tente novamente.')
 }
}
