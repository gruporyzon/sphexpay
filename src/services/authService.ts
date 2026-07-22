import type { Provider } from '@supabase/supabase-js'
import { oauthAvailability,supabase } from '../lib/supabase'

const callback=()=>`${window.location.origin}/auth/callback`
const timed=<T,>(operation:PromiseLike<T>)=>Promise.race([Promise.resolve(operation),new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('timeout')),15000))])
export const authMessage=(error:unknown)=>{const message=error instanceof Error?error.message.toLowerCase():'';if(message.includes('not_configured'))return'A autenticação ainda não está disponível neste ambiente.';if(message.includes('provider_not_configured'))return'Este provedor de acesso ainda não está configurado.';if(message.includes('invalid login'))return'E-mail ou senha inválidos.';if(message.includes('email not confirmed'))return'Confirme seu e-mail antes de entrar.';if(message.includes('user banned'))return'Esta conta está temporariamente indisponível. Entre em contato com o suporte.';if(message.includes('rate')||message.includes('too many'))return'Muitas tentativas. Aguarde alguns minutos.';if(message.includes('timeout')||message.includes('fetch'))return'Não foi possível conectar. Verifique sua internet e tente novamente.';return'Não foi possível concluir a autenticação. Tente novamente.'}
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
