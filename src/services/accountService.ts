import { supabase } from '../lib/supabase'

// Conta do próprio usuário: nome de exibição e aparelhos conectados (sessões do Supabase Auth).
export type AccountSession={id:string;createdAt:string;lastSeenAt:string;userAgent:string;ip:string;aal:string;current:boolean}

const client=()=>{if(!supabase)throw new Error('A conexão com o servidor não está disponível.');return supabase}
export function describeDevice(userAgent:string){
 const ua=userAgent||'',system=/iPhone|iPad/.test(ua)?'iPhone/iPad':/Android/.test(ua)?'Android':/Windows/.test(ua)?'Windows':/Mac OS X|Macintosh/.test(ua)?'Mac':/Linux/.test(ua)?'Linux':'Aparelho'
 const browser=/Edg\//.test(ua)?'Edge':/OPR\/|Opera/.test(ua)?'Opera':/Firefox\//.test(ua)?'Firefox':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':''
 return browser?`${browser} · ${system}`:system
}
export const accountService={
 async sessions():Promise<AccountSession[]>{
  const {data,error}=await client().rpc('my_sessions')
  if(error)throw new Error('Não foi possível carregar os aparelhos conectados.')
  return((data||[]) as Record<string,unknown>[]).map(row=>({id:String(row.id),createdAt:String(row.created_at),lastSeenAt:String(row.last_seen_at||row.created_at),userAgent:String(row.user_agent||''),ip:String(row.ip||''),aal:String(row.aal||''),current:row.current===true}))
 },
 async signOutOthers(){
  const {error}=await client().auth.signOut({scope:'others'})
  if(error)throw new Error('Não foi possível encerrar as outras sessões.')
 },
 async updateName(name:string){
  const value=name.trim()
  if(value.length<2||value.length>120)throw new Error('Informe um nome entre 2 e 120 caracteres.')
  const {error}=await client().auth.updateUser({data:{full_name:value}})
  if(error)throw new Error('Não foi possível salvar o nome.')
 }
}
