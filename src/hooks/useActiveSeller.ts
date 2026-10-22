import type { User } from '@supabase/supabase-js'
import { useAuth } from './useAuth'
import { roleCan,useWorkspaceStore,type TeamPermission } from '../store/useWorkspaceStore'

// Conta exibida no painel: a própria ou a de quem convidou (colaborador). `can` diz o que o
// cargo libera; o dono pode tudo.
export function useActiveSeller(){
 // Sem AuthProvider (telas isoladas) vale a própria conta; useAuth sempre lê o contexto antes de
 // falhar, então a ordem dos hooks não muda.
 let user:User|null|undefined
 // eslint-disable-next-line react-hooks/rules-of-hooks -- chamada incondicional; o try só trata a ausência do provider
 try{user=useAuth().user}catch{user=undefined}
 const workspace=useWorkspaceStore(state=>state.workspace)
 const member=Boolean(workspace&&user&&workspace.ownerId!==user.id)
 return{
  sellerId:member?workspace!.ownerId:user?.id,
  seller:member?workspace!.ownerId:null,
  workspace:member?workspace:null,
  member,
  can:(permission:TeamPermission)=>!member||roleCan(workspace?.role,permission)
 }
}
