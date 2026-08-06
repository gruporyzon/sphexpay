import { useMemo,useState } from 'react'
import { CheckCheck,Search,Settings2,Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Empty,PageTitle } from '../components/ui'
import { NotificationItem } from '../components/notifications/NotificationItem'
import { usePlatformNotifications } from '../hooks/usePlatformNotifications'

const filters=['Todas','Não lidas','Segurança','Premiações','Arquivadas'] as const
export default function NotificationsPage(){
 const [filter,setFilter]=useState<(typeof filters)[number]>('Todas'),[query,setQuery]=useState(''),[visible,setVisible]=useState(10)
 const {notifications,read,readAll,archive,remove,clear}=usePlatformNotifications(),navigate=useNavigate(),unread=notifications.filter(item=>!item.read&&!item.archived).length
 const filtered=useMemo(()=>notifications.filter(item=>{const matchesFilter=filter==='Todas'?!item.archived:filter==='Não lidas'?!item.read&&!item.archived:filter==='Arquivadas'?item.archived:filter==='Premiações'?item.kind==='achievement'||item.kind==='goal':item.category==='Segurança';return matchesFilter&&`${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase())}),[notifications,filter,query])
 return <div className="page-enter notifications-page internal-real-page">
  <PageTitle title="Notificações" subtitle="Comunicados administrativos, segurança e premiações." action={<div className="flex flex-wrap gap-2"><button className="btn" onClick={readAll} disabled={!unread}><CheckCheck/> Marcar todas como lidas</button><button className="btn" onClick={()=>{if(confirm('Limpar todo o histórico de notificações?'))clear()}} disabled={!notifications.length}><Trash2/> Limpar histórico</button><button className="btn btn-primary" onClick={()=>navigate('/app/configuracoes?secao=Notificações')}><Settings2/> Configurar</button></div>}/>
  <div className="notification-summary"><span>{unread}</span><div><strong>Notificações não lidas</strong><p>Alguns comunicados permanecem somente nesta interface e não geram Push.</p></div></div>
  <label className="notification-search"><Search/><input aria-label="Buscar notificações" placeholder="Buscar comunicado ou alerta..." value={query} onChange={event=>setQuery(event.target.value)}/></label>
  <div className="notification-filters scrollbar" role="tablist" aria-label="Filtrar notificações">{filters.map(item=><button role="tab" aria-selected={filter===item} className={filter===item?'active':''} key={item} onClick={()=>{setFilter(item);setVisible(10)}}>{item}</button>)}</div>
  <section className="panel notification-page-list">{filtered.slice(0,visible).map(item=>{const isDemo=item.metadata?.source==='demo';return <NotificationItem key={item.id} notification={item} onRead={read} onArchive={isDemo?undefined:archive} onDelete={isDemo?undefined:remove}/>})}{!filtered.length&&<Empty text="Nenhuma notificação nesta categoria."/>}</section>
  {visible<filtered.length&&<button className="btn notification-load" onClick={()=>setVisible(value=>value+10)}>Carregar mais</button>}
 </div>
}
