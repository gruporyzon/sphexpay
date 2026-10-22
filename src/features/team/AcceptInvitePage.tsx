import { useEffect,useRef,useState } from 'react'
import { Link,useParams } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { T,translate as uiText } from '../../i18n'
import { useAppLocale } from '../../i18n/localeStore'
import { Card,Loading,StateMessage } from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'
import { teamService } from '../../services/teamService'
import { useWorkspaceStore } from '../../store/useWorkspaceStore'

// Aceite do convite de equipe: exige estar logado com o e-mail convidado. Depois de aceito,
// abre o painel já na conta de quem convidou.
export default function AcceptInvitePage(){useAppLocale(state=>state.locale)
 const {token=''}=useParams(),user=useAuth().user,started=useRef(false),[error,setError]=useState('')
 useEffect(()=>{
  if(started.current||!token)return
  started.current=true
  teamService.accept(token).then(async ownerId=>{
   const workspace=(await teamService.workspaces()).find(row=>row.ownerId===ownerId)||null
   useWorkspaceStore.getState().setWorkspace(workspace)
   location.replace('/app')
  }).catch(reason=>setError(reason instanceof Error?reason.message:'Não foi possível aceitar o convite.'))
 },[token])
 return <main className="auth-page flex min-h-screen items-center justify-center p-4"><Card className="p-6 w-full max-w-md">
  <b className="flex items-center gap-2"><ShieldCheck size={16} aria-hidden="true"/><T>Convite de equipe</T></b>
  {error?<div className="mt-3 grid gap-3"><StateMessage title={uiText('Convite não aceito')}><span>{error}</span></StateMessage>
   <p className="muted text-sm"><T>Conectado como </T>{user?.email}</p><Link className="btn" to="/app"><T>Ir para o painel</T></Link></div>:<Loading label="Aceitando convite"/>}
 </Card></main>
}
