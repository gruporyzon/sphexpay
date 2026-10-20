import {translate as uiText} from '../../i18n'
import {useAppLocale} from '../../i18n/localeStore'
import {T} from '../../i18n'
import { RefreshCcw } from 'lucide-react'

export function RealtimeStatus({status,updatedAt,onRefresh,loading,iconOnly=false}:{status:'live'|'reconnecting'|'unavailable';updatedAt:string;onRefresh:()=>void;loading:boolean;iconOnly?:boolean}){useAppLocale(state=>state.locale);
 const label=status==='live'?'Atualização ao vivo':status==='reconnecting'?'Reconectando':'Atualização manual'
 if(iconOnly)return <button className="btn icon-btn dashboard-refresh-button" aria-label={uiText("Atualizar dashboard")} title={uiText("Atualizar dashboard")} onClick={onRefresh} disabled={loading}><RefreshCcw className={loading?'spin':''}/></button>
 return <div className={`dashboard-realtime ${status}`}><i/><span><T>{label}</T></span>{updatedAt&&<small><T>Última atualização </T>{new Date(updatedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small>}<button className="btn icon-btn" aria-label={uiText("Atualizar vendas")} onClick={onRefresh} disabled={loading}><RefreshCcw className={loading?'spin':''}/></button></div>
}
