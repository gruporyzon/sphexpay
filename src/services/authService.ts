import type { Provider } from '@supabase/supabase-js'
import { oauthAvailability,supabase } from '../lib/supabase'

const callback=()=>`${window.location.origin}/auth/callback`
const timed=<T,>(operation:PromiseLike<T>)=>Promise.race([Promise.resolve(operation),new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('timeout')),15000))])
export const authMessage=(error:unknown)=>{
 const message=error instanceof Error?error.message.toLowerCase():''
 if(message.includes('not_configured'))return'A autenticação ainda não está disponível neste ambiente.'
 if(message.includes('provider_not_configured')||message.includes('provider is not enabled'))return'Este provedor de acesso ainda não está configurado.'
 if(message.includes('invalid login')||message.includes('invalid credentials'))return'E-mail ou senha inválidos.'
 if(message.includes('email not confirmed'))return'Confirme seu e-mail antes de entrar.'
 if(message.includes('user already registered')||message.includes('already been registered'))return'Este e-mail já está cadastrado.'
 if(message.includes('password should be')||message.includes('weak password'))return'A senha não atende aos requisitos de segurança.'
 if(message.includes('same password'))return'A nova senha deve ser diferente da senha atual.'
 if(message.includes('invalid email'))return'Informe um endereço de e-mail válido.'
 if(message.includes('signup is disabled'))return'O cadastro de novas contas está temporariamente indisponível.'
 if(message.includes('user banned'))return'Esta conta está temporariamente indisponível. Entre em contato com o suporte.'
 if(message.includes('rate')||message.includes('too many')||message.includes('over_email_send_rate_limit'))return'Muitas tentativas. Aguarde alguns minutos.'
 if(message.includes('expired')||message.includes('otp_expired'))return'O link expirou. Solicite um novo e tente novamente.'
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
 signUp:(email:string,password:string,data:Record<string,unknown>)=>timed(client().auth.signUp({email,password,options:{data,emailRedirectTo:callback()}})),
 signInWithOAuth:(provider:Provider)=>{if(!oauthAvailability[provider as 'google'|'apple'])throw new Error('provider_not_configured');sessionStorage.setItem('sphexpay-oauth-return','/app');return timed(client().auth.signInWithOAuth({provider,options:{redirectTo:callback(),skipBrowserRedirect:false}}))},
 signOut:async()=>{const result=await timed(client().auth.signOut({scope:'local'}));clearSessionPersistence();return result},
 resetPassword:(email:string)=>timed(client().auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/nova-senha`})),
 updatePassword:(password:string)=>timed(client().auth.updateUser({password})),
 updateMetadata:(data:Record<string,unknown>)=>timed(client().auth.updateUser({data})),
 resendConfirmation:(email:string)=>timed(client().auth.resend({type:'signup',email,options:{emailRedirectTo:callback()}}))
}
