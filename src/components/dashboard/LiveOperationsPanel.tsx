import { useEffect,useState } from 'react'
import { Activity,RefreshCcw,Send } from 'lucide-react'
import { Card } from '../ui'
import { liveOperationsService,type LiveOperationsStatus } from '../../services/liveOperationsService'

const date=(value:string|null)=>value?new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Sem registro'
export function LiveOperationsPanel(){
 const [status,setStatus]=useState<LiveOperationsStatus|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const refresh=async()=>{setLoading(true);setError('');try{setStatus(await liveOperationsService.load())}catch{setError('Não foi possível consultar a operação ao vivo.')}finally{setLoading(false)}}
 useEffect(()=>{void refresh()},[])
 const testPush=async()=>{setNotice('');try{await liveOperationsService.testPush();setNotice('Teste técnico enviado. Ele não cria venda nem altera faturamento.')}catch{setNotice('O teste técnico de Push não pôde ser enviado.')} }
 return <Card className="dashboard-live-operations"><header><div><span className="section-eyebrow"><Activity/> OPERAÇÃO AO VIVO</span><h2>Infraestrutura financeira</h2></div><button className="btn icon-btn" aria-label="Atualizar operação" onClick={()=>void refresh()} disabled={loading}><RefreshCcw className={loading?'spin':''}/></button></header>
  {error?<p role="alert">{error}</p>:status?<div className="dashboard-operation-grid">
   <span>Webhook <b>{status.webhookConfigured?'Configurado':'Pendente'}</b></span>
   <span>Realtime <b>{status.realtimeTable}</b></span>
   <span>Push <b>{status.pushConfigured?'Configurado':'Pendente'}</b></span>
   <span>Última transação <b>{date(status.lastTransactionAt)}</b></span>
   <span>Última aprovação <b>{date(status.lastApprovedAt)}</b></span>
   <span>Último Push <b>{date(status.lastPushAt)}</b></span>
   <span>Dispositivos ativos <b>{status.activeDevices}</b></span>
   <span>Outbox pendente <b>{status.pendingEvents}</b></span>
   <span>Outbox com falha <b>{status.failedEvents}</b></span>
  </div>:null}
  <footer><button className="btn" onClick={()=>void testPush()}><Send/> Testar infraestrutura Push</button>{notice&&<small role="status">{notice}</small>}</footer>
 </Card>
}
