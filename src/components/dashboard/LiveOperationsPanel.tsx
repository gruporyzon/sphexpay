import {translate as uiText} from '../../i18n'
import {useAppLocale} from '../../i18n/localeStore'
import {T} from '../../i18n'
import { useEffect,useState } from 'react'
import { Activity,RefreshCcw,Send } from 'lucide-react'
import { Card } from '../ui'
import { liveOperationsService,type LiveOperationsStatus } from '../../services/liveOperationsService'

const date=(value:string|null)=>value?new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Sem registro'
export function LiveOperationsPanel(){useAppLocale(state=>state.locale);
 const [status,setStatus]=useState<LiveOperationsStatus|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const refresh=async()=>{setLoading(true);setError('');try{setStatus(await liveOperationsService.load())}catch{setError('Não foi possível consultar a operação ao vivo.')}finally{setLoading(false)}}
 useEffect(()=>{void refresh()},[])
 const testPush=async()=>{setNotice('');try{await liveOperationsService.testPush();setNotice('Teste técnico enviado. Ele não cria venda nem altera faturamento.')}catch{setNotice('O teste técnico de Push não pôde ser enviado.')} }
 return <Card className="dashboard-live-operations"><header><div><span className="section-eyebrow"><Activity/><T> OPERAÇÃO AO VIVO</T></span><h2><T>Infraestrutura financeira</T></h2></div><button className="btn icon-btn" aria-label={uiText("Atualizar operação")} onClick={()=>void refresh()} disabled={loading}><RefreshCcw className={loading?'spin':''}/></button></header>
  {error?<p role="alert">{error}</p>:status?<div className="dashboard-operation-grid">
   <span><T>Webhook </T><b><T>{status.webhookConfigured?'Configurado':'Pendente'}</T></b></span>
   <span><T>Realtime </T><b>{status.realtimeTable}</b></span>
   <span><T>Push </T><b><T>{status.pushConfigured?'Configurado':'Pendente'}</T></b></span>
   <span><T>Última transação </T><b>{date(status.lastTransactionAt)}</b></span>
   <span><T>Última aprovação </T><b>{date(status.lastApprovedAt)}</b></span>
   <span><T>Último Push </T><b>{date(status.lastPushAt)}</b></span>
   <span><T>Dispositivos ativos </T><b>{status.activeDevices}</b></span>
   <span><T>Outbox pendente </T><b>{status.pendingEvents}</b></span>
   <span><T>Outbox com falha </T><b>{status.failedEvents}</b></span>
  </div>:null}
  <footer><button className="btn" onClick={()=>void testPush()}><Send/><T> Testar infraestrutura Push</T></button>{notice&&<small role="status">{notice}</small>}</footer>
 </Card>
}
