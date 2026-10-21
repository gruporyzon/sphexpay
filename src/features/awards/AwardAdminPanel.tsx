import { useCallback,useEffect,useState } from 'react'
import { PackageCheck,RotateCcw,Save } from 'lucide-react'
import { T,translate as uiText } from '../../i18n'
import { useAppLocale } from '../../i18n/localeStore'
import { Card,Empty,Loading,StateMessage } from '../../components/ui'
import { shortDate } from '../../lib/utils'
import { AWARD_STATUS_LABEL,awardService,type AdminAwardRequest,type AwardRequestState } from '../../services/awardService'

// Fila da equipe (admin): endereço de entrega, status do envio e código de rastreio.
// Cada mudança de status notifica o vendedor na central de notificações.
const FILTERS:(AwardRequestState|'all')[]=['requested','preparing','shipped','delivered','cancelled','all']
const STATES=Object.keys(AWARD_STATUS_LABEL) as AwardRequestState[]

export function AwardAdminPanel(){useAppLocale(state=>state.locale)
 const [filter,setFilter]=useState<AwardRequestState|'all'>('requested'),[items,setItems]=useState<AdminAwardRequest[]|null>(null),[error,setError]=useState('')
 const [drafts,setDrafts]=useState<Record<string,{status:AwardRequestState;tracking:string}>>({}),[busy,setBusy]=useState(''),[saved,setSaved]=useState('')
 const load=useCallback(()=>{setItems(null);setError('');awardService.adminList(filter==='all'?undefined:filter).then(rows=>{setItems(rows);setDrafts(Object.fromEntries(rows.map(row=>[row.id,{status:row.status,tracking:row.trackingCode||''}])))}).catch(reason=>{setItems([]);setError(reason instanceof Error?reason.message:'Não foi possível carregar os pedidos.')})},[filter])
 useEffect(()=>{load()},[load])
 const save=async(item:AdminAwardRequest)=>{
  const draft=drafts[item.id];setBusy(item.id);setError('');setSaved('')
  try{await awardService.adminUpdate(item.id,draft.status,draft.tracking);setSaved(item.id);load()}
  catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível atualizar o pedido.')}
  finally{setBusy('')}
 }
 return <section className="mt-8" aria-label={uiText('Pedidos de premiação (equipe)')}>
  <div className="flex items-center justify-between gap-3 flex-wrap mb-3"><div><h2 className="text-lg font-semibold"><PackageCheck size={18} className="inline mr-2"/><T>Pedidos de premiação (equipe)</T></h2><p className="muted text-sm"><T>Visível só para administradores. O vendedor é avisado a cada mudança de status.</T></p></div>
   <div className="report-tabs" role="group" aria-label={uiText('Filtrar pedidos')}>{FILTERS.map(item=><button key={item} className={filter===item?'active':''} aria-pressed={filter===item} onClick={()=>setFilter(item)}><T>{item==='all'?'Todos':AWARD_STATUS_LABEL[item]}</T></button>)}</div></div>
  {error&&<div className="mb-3"><StateMessage title={uiText('Pedidos indisponíveis')}><span>{error}</span> <button className="btn" onClick={load}><RotateCcw size={14}/><T> Tentar novamente</T></button></StateMessage></div>}
  {items===null?<Loading label="Carregando pedidos"/>:items.length===0?<Card><Empty title={uiText('Nenhum pedido aqui')} text={uiText('Os pedidos de plaquinha aparecem nesta lista assim que os vendedores solicitam.')}/></Card>:
  <div className="grid gap-3">{items.map(item=>{const draft=drafts[item.id]||{status:item.status,tracking:''},address=item.address;return <Card className="p-4" key={item.id}>
   <div className="flex flex-wrap justify-between gap-2"><div><b>Sphex {item.awardId.toUpperCase()}</b> · {item.sellerName||item.sellerEmail}<small className="muted block">{item.sellerEmail} · <T>pedido em </T>{shortDate(item.requestedAt)}</small></div><span className="badge">{AWARD_STATUS_LABEL[item.status]}</span></div>
   <p className="text-sm mt-2">{address.recipient} · {address.phone}<br/>{address.street}, {address.number}{address.complement?` · ${address.complement}`:''} · {address.district}<br/>{address.city}/{address.state} · {address.postalCode} · {address.country}{address.reference?<><br/><T>Referência: </T>{address.reference}</>:null}</p>
   <div className="flex flex-wrap items-end gap-2 mt-3">
    <label><span className="label"><T>Status</T></span><select className="input" aria-label={`${uiText('Status do pedido de')} ${item.sellerEmail}`} value={draft.status} onChange={event=>setDrafts(current=>({...current,[item.id]:{...draft,status:event.target.value as AwardRequestState}}))}>{STATES.map(state=><option key={state} value={state}>{AWARD_STATUS_LABEL[state]}</option>)}</select></label>
    <label className="flex-1 min-w-[180px]"><span className="label"><T>Código de rastreio</T></span><input className="input" maxLength={80} value={draft.tracking} onChange={event=>setDrafts(current=>({...current,[item.id]:{...draft,tracking:event.target.value}}))} placeholder={uiText('Opcional')}/></label>
    <button className="btn btn-primary" disabled={busy===item.id} onClick={()=>void save(item)}><Save size={15}/><T>{busy===item.id?' Salvando...':' Salvar'}</T></button>
    {saved===item.id&&<span className="muted text-sm" role="status"><T>Atualizado.</T></span>}
   </div>
  </Card>})}</div>}
 </section>
}
