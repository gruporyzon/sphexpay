import { useEffect,useState,type ReactNode } from 'react'
import { Link,useLocation } from 'react-router-dom'
import { Building2,ShieldOff } from 'lucide-react'
import { T,translate as uiText } from '../../i18n'
import { useAppLocale } from '../../i18n/localeStore'
import { Card } from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'
import { useActiveSeller } from '../../hooks/useActiveSeller'
import { memberCanOpen } from '../../lib/teamAccess'
import { ROLE_LABEL,teamService } from '../../services/teamService'
import { useWorkspaceStore,type Workspace } from '../../store/useWorkspaceStore'

// Troca entre a própria conta e as contas em que a pessoa é colaboradora. A escolha salva é
// conferida no banco a cada entrada: acesso removido volta para a própria conta.
export function WorkspaceSwitcher({navigationRoot='/app'}:{navigationRoot?:string}){useAppLocale(state=>state.locale)
 const user=useAuth().user,workspace=useWorkspaceStore(state=>state.workspace),setWorkspace=useWorkspaceStore(state=>state.setWorkspace)
 const [options,setOptions]=useState<Workspace[]>([])
 useEffect(()=>{
  if(!user?.id){setOptions([]);return}
  let active=true
  teamService.workspaces().then(rows=>{
   if(!active)return
   setOptions(rows)
   const current=useWorkspaceStore.getState().workspace
   if(current){const match=rows.find(row=>row.ownerId===current.ownerId);if(!match){setWorkspace(null);location.assign(navigationRoot)}else if(match.role!==current.role)setWorkspace(match)}
  }).catch(()=>{if(active)setOptions([])})
  return()=>{active=false}
 },[user?.id,setWorkspace,navigationRoot])
 if(!options.length&&!workspace)return null
 const change=(ownerId:string)=>{setWorkspace(options.find(row=>row.ownerId===ownerId)||null);location.assign(navigationRoot)}
 return <div className={`workspace-switcher${workspace?' is-member':''}`} role="region" aria-label={uiText('Conta em uso')}>
  <Building2 size={16} aria-hidden="true"/>
  <span className="workspace-switcher-text">{workspace?<><T>Você está na conta de </T><b>{workspace.ownerName||workspace.ownerEmail}</b><T> como </T><b><T>{ROLE_LABEL[workspace.role]}</T></b></>:<T>Você está na sua conta</T>}</span>
  <label className="sr-only" htmlFor="workspace-switcher-select"><T>Trocar de conta</T></label>
  <select id="workspace-switcher-select" className="input workspace-switcher-select" value={workspace?.ownerId||''} onChange={event=>change(event.target.value)}>
   <option value="">{uiText('Minha conta')}</option>
   {options.map(row=><option key={row.ownerId} value={row.ownerId}>{`${row.ownerName||row.ownerEmail} · ${uiText(ROLE_LABEL[row.role])}`}</option>)}
  </select>
 </div>
}

// Colaborador abrindo uma área fora do cargo vê o aviso no lugar da página.
export function MemberRouteGuard({children,navigationRoot='/app'}:{children:ReactNode;navigationRoot?:string}){useAppLocale(state=>state.locale)
 const {pathname,search}=useLocation(),{workspace}=useActiveSeller()
 if(!workspace||memberCanOpen(workspace.role,pathname.replace(navigationRoot,'/app'),search))return <>{children}</>
 return <Card className="p-6 max-w-xl"><b className="flex items-center gap-2"><ShieldOff size={16} aria-hidden="true"/><T>Área fora do seu cargo</T></b>
  <p className="muted mt-2"><T>Como </T><T>{ROLE_LABEL[workspace.role]}</T><T>, você não acessa esta área da conta de quem convidou. Para usar a sua própria conta, troque no seletor acima.</T></p>
  <Link className="btn mt-4" to={navigationRoot}><T>Ir para a visão geral</T></Link></Card>
}
