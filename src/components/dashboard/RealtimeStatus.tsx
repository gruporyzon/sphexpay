import { RefreshCcw } from 'lucide-react'

export function RealtimeStatus({status,updatedAt,onRefresh,loading}:{status:'live'|'reconnecting'|'unavailable';updatedAt:string;onRefresh:()=>void;loading:boolean}){
 const label=status==='live'?'Atualização ao vivo':status==='reconnecting'?'Reconectando':'Atualização manual'
 return <div className={`dashboard-realtime ${status}`}><i/><span>{label}</span>{updatedAt&&<small>Última atualização {new Date(updatedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small>}<button className="btn icon-btn" aria-label="Atualizar vendas" onClick={onRefresh} disabled={loading}><RefreshCcw className={loading?'spin':''}/></button></div>
}
