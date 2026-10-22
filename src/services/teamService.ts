import { supabase } from '../lib/supabase'
import type { TeamRole,Workspace } from '../store/useWorkspaceStore'

// Equipe da conta: convites por e-mail com cargo fixo. O link do convite leva um código de uso
// único; o banco guarda só o hash e confere o e-mail de quem aceita.
export type TeamMember={id:string;email:string;role:TeamRole;status:'invited'|'active'|'expired';invitedAt:string;acceptedAt:string|null;memberName:string|null}
export const ROLE_LABEL:Record<TeamRole,string>={admin:'Administrador',finance:'Financeiro',support:'Suporte'}
export const ROLE_DESCRIPTION:Record<TeamRole,string>={
 admin:'Vendas, clientes, encomendas, relatórios, assinaturas, afiliados e financeiro. Não faz reembolso, cobrança nem mexe em conta e segurança.',
 finance:'Vendas, contestações, clientes, relatórios, assinaturas, afiliados e financeiro (somente leitura).',
 support:'Vendas, clientes, carrinhos e encomendas, com atualização de envio. Sem reembolsos.'
}

const client=()=>{if(!supabase)throw new Error('A conexão com o servidor não está disponível.');return supabase}
const MESSAGES:Record<string,string>={
 INVALID_EMAIL:'Informe um e-mail válido.',SELF_INVITE:'Você não pode convidar a si mesmo.',ALREADY_INVITED:'Este e-mail já está na sua equipe.',TEAM_LIMIT:'Sua equipe chegou ao limite de 20 pessoas.',
 INVITE_NOT_FOUND:'Convite inválido ou já usado.',INVITE_EMAIL_MISMATCH:'Este convite foi enviado para outro e-mail. Entre com a conta do e-mail convidado.',INVITE_EXPIRED:'Este convite expirou. Peça um novo a quem convidou.',
 MEMBER_NOT_FOUND:'Pessoa não encontrada na equipe.'
}
const failure=(error:{message?:string},fallback:string)=>new Error(Object.entries(MESSAGES).find(([code])=>error.message?.includes(code))?.[1]||fallback)
const roleOf=(value:unknown):TeamRole=>value==='admin'||value==='finance'?value:'support'

export const teamService={
 inviteLink:(token:string)=>`${typeof location==='undefined'?'':location.origin}/convite/${token}`,
 async list():Promise<TeamMember[]>{
  const {data,error}=await client().rpc('my_team')
  if(error)throw failure(error,'Não foi possível carregar sua equipe.')
  return((data||[]) as Record<string,unknown>[]).map(row=>({id:String(row.id),email:String(row.email),role:roleOf(row.role),status:row.status==='active'?'active':row.status==='expired'?'expired':'invited',invitedAt:String(row.invited_at),acceptedAt:typeof row.accepted_at==='string'?row.accepted_at:null,memberName:typeof row.member_name==='string'?row.member_name:null}))
 },
 async invite(email:string,role:TeamRole):Promise<string>{
  const {data,error}=await client().rpc('invite_team_member',{p_email:email,p_role:role})
  if(error||typeof data!=='string')throw failure(error||{},'Não foi possível criar o convite.')
  return data
 },
 async changeRole(id:string,role:TeamRole){const {error}=await client().rpc('update_team_member',{p_id:id,p_role:role,p_revoke:false});if(error)throw failure(error,'Não foi possível mudar o cargo.')},
 async revoke(id:string){const {error}=await client().rpc('update_team_member',{p_id:id,p_role:null,p_revoke:true});if(error)throw failure(error,'Não foi possível remover o acesso.')},
 async accept(token:string):Promise<string>{
  const {data,error}=await client().rpc('accept_team_invite',{p_token:token})
  if(error)throw failure(error,'Não foi possível aceitar o convite.')
  return String(data)
 },
 async workspaces():Promise<Workspace[]>{
  const {data,error}=await client().rpc('my_workspaces')
  if(error)throw failure(error,'Não foi possível carregar as contas da equipe.')
  return((data||[]) as Record<string,unknown>[]).map(row=>({ownerId:String(row.owner_id),ownerName:String(row.owner_name||''),ownerEmail:String(row.owner_email||''),role:roleOf(row.role)}))
 }
}
