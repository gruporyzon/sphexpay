import type { Provider } from '@supabase/supabase-js'
import { oauthAvailability,supabase } from '../lib/supabase'

const callback=()=>`${window.location.origin}/auth/callback`
const timed=<T,>(operation:PromiseLike<T>)=>Promise.race([Promise.resolve(operation),new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('timeout')),15000))])

type SupabaseErrorDetails={
 name?:unknown
 code?:unknown
 status?:unknown
 message?:unknown
}

const errorDetails=(error:unknown):SupabaseErrorDetails=>
 typeof error==='object'&&error!==null?error:{}

const signupMessages:Record<string,string>={
 user_already_exists:'Já existe uma conta com este e-mail.',
 email_address_invalid:'Digite um endereço de e-mail válido.',
 weak_password:'A senha não atende aos requisitos de segurança.',
 signup_disabled:'Novos cadastros estão temporariamente desativados.',
 over_email_send_rate_limit:'Muitas tentativas foram realizadas. Aguarde alguns minutos.',
 database_error:'Não foi possível criar o perfil da conta.',
 unexpected_failure:'O serviço de autenticação encontrou um erro inesperado.'
}

export const authMessage=(error:unknown)=>{
 const details=errorDetails(error)
 const code=typeof details.code==='string'?details.code.toLowerCase():''
 const originalMessage=typeof details.message==='string'?details.message.trim():''
 const message=originalMessage.toLowerCase()
 if(code&&signupMessages[code])return signupMessages[code]
 if(message.includes('not_configured'))return'A autenticação ainda não está disponível neste ambiente.'
 if(message.includes('provider_not_configured')||message.includes('provider is not enabled'))return'Este provedor de acesso ainda não está configurado.'
 if(message.includes('invalid login')||message.includes('invalid credentials'))return'E-mail ou senha inválidos.'
 if(message.includes('email not confirmed'))return'Confirme seu e-mail antes de entrar.'
 if(message.includes('user already registered')||message.includes('already been registered'))return'Já existe uma conta com este e-mail.'
 if(message.includes('password should be')||message.includes('weak password'))return'A senha não atende aos requisitos de segurança.'
 if(message.includes('same password'))return'A nova senha deve ser diferente da senha atual.'
 if(message.includes('invalid email'))return'Digite um endereço de e-mail válido.'
 if(message.includes('signup is disabled'))return'Novos cadastros estão temporariamente desativados.'
 if(message.includes('user banned'))return'Esta conta está temporariamente indisponível. Entre em contato com o suporte.'
 if(message.includes('rate')||message.includes('too many')||message.includes('over_email_send_rate_limit'))return'Muitas tentativas foram realizadas. Aguarde alguns minutos.'
 if(message.includes('expired')||message.includes('otp_expired'))return'O link expirou. Solicite um novo e tente novamente.'
 if(code==='mfa_verification_failed'||message.includes('invalid totp')||message.includes('invalid code')||message.includes('mfa_verification_failed'))return'Código de verificação inválido. Confira o app autenticador e tente novamente.'
 if(message.includes('totp')&&message.includes('expired'))return'O código expirou. Gere um novo no app autenticador.'
 if(code==='mfa_factor_name_conflict'||message.includes('factor_name_conflict'))return'Já existe um fator de autenticação com este nome.'
 if(message.includes('aal2')||message.includes('assurance'))return'É necessário concluir a verificação em duas etapas para continuar.'
 if(message.includes('timeout')||message.includes('fetch')||message.includes('network'))return'Não foi possível conectar. Verifique sua internet e tente novamente.'
 return'Não foi possível concluir a autenticação. Tente novamente.'
}
function client(){if(!supabase)throw new Error('not_configured');return supabase}
const temporaryKey='sphexpay-temporary-session'
export function setSessionPersistence(remember:boolean){if(remember){localStorage.removeItem(temporaryKey);sessionStorage.removeItem(temporaryKey)}else{localStorage.setItem(temporaryKey,'1');sessionStorage.setItem(temporaryKey,'1')}}
export function shouldEndTemporarySession(){return localStorage.getItem(temporaryKey)==='1'&&sessionStorage.getItem(temporaryKey)!=='1'}
export function clearSessionPersistence(){localStorage.removeItem(temporaryKey);sessionStorage.removeItem(temporaryKey)}
export const authService={
 signIn:(email:string,password:string)=>timed(client().auth.signInWithPassword({email,password})),
 signUp:async(email:string,password:string,userData:Record<string,unknown>)=>{
  const {data,error}=await client().auth.signUp({email,password,options:{data:userData,emailRedirectTo:callback()}})
  return{data,error}
 },
 signInWithOAuth:(provider:Provider)=>{if(!oauthAvailability[provider as 'google'|'apple'])throw new Error('provider_not_configured');sessionStorage.setItem('sphexpay-oauth-return','/app');return timed(client().auth.signInWithOAuth({provider,options:{redirectTo:callback(),skipBrowserRedirect:false}}))},
 signOut:async()=>{const result=await timed(client().auth.signOut({scope:'local'}));clearSessionPersistence();return result},
 resetPassword:(email:string)=>timed(client().auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/nova-senha`})),
 updatePassword:(password:string)=>timed(client().auth.updateUser({password})),
 updateMetadata:(data:Record<string,unknown>)=>timed(client().auth.updateUser({data})),
 resendConfirmation:(email:string)=>timed(client().auth.resend({type:'signup',email,options:{emailRedirectTo:callback()}}))
}

export type AssuranceLevel={currentLevel:string|null;nextLevel:string|null}

// Camada fina sobre supabase.auth.mfa — TOTP nativo do Supabase, sem função serverless.
export const mfaService={
 async assuranceLevel():Promise<AssuranceLevel>{
  try{
   const {data,error}=await client().auth.mfa.getAuthenticatorAssuranceLevel()
   if(error||!data)return{currentLevel:null,nextLevel:null}
   return{currentLevel:data.currentLevel??null,nextLevel:data.nextLevel??null}
  }catch{return{currentLevel:null,nextLevel:null}}
 },
 async listFactors(){
  const {data,error}=await client().auth.mfa.listFactors()
  if(error)throw error
  return{all:data?.all??[],totp:data?.totp??[]}
 },
 verifiedTotpFactor(factors:{id:string;status:string;factor_type:string}[]){
  return factors.find(factor=>factor.factor_type==='totp'&&factor.status==='verified')
 },
 async enroll(){
  const {data,error}=await timed(client().auth.mfa.enroll({factorType:'totp'}))
  if(error)throw error
  return data
 },
 async challengeAndVerify(factorId:string,code:string){
  const {data,error}=await timed(client().auth.mfa.challengeAndVerify({factorId,code:code.trim()}))
  if(error)throw error
  return data
 },
 async unenroll(factorId:string){
  const {data,error}=await timed(client().auth.mfa.unenroll({factorId}))
  if(error)throw error
  return data
 }
}

// Registro best-effort de evento de segurança do próprio usuário (RPC record_security_event).
export async function recordSecurityEvent(eventType:string,metadata:Record<string,unknown>={}){
 try{await client().rpc('record_security_event',{p_event_type:eventType,p_metadata:metadata})}
 catch{/* auditoria não deve bloquear a ação do usuário */}
}
