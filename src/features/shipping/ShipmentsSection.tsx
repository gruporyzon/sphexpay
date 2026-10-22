import { useCallback,useEffect,useMemo,useState } from 'react'
import { Download,PackageCheck,RotateCcw,Save } from 'lucide-react'
import { T,translate as uiText } from '../../i18n'
import { useAppLocale } from '../../i18n/localeStore'
import { Card,Empty,Loading,SearchBox,StateMessage } from '../../components/ui'
import { formatCents } from '../../lib/currencyFormat'
import { downloadCsv,shortDate } from '../../lib/utils'
import { FULFILLMENT_LABEL,shippingService,type FulfillmentStatus,type Shipment } from '../../services/shippingService'

const STATES=Object.keys(FULFILLMENT_LABEL) as FulfillmentStatus[]
const line=(item:Shipment)=>`${item.address.street}, ${item.address.number}${item.address.complement?` · ${item.address.complement}`:''} · ${item.address.district} · ${item.address.city}/${item.address.state} · ${item.address.postalCode}`

// Encomendas: pedidos pagos de produto físico com endereço, status do envio e rastreio.
export function ShipmentsSection(){useAppLocale(state=>state.locale)
 const [items,setItems]=useState<Shipment[]|null>(null),[error,setError]=useState(''),[query,setQuery]=useState(''),[status,setStatus]=useState<FulfillmentStatus|'all'>('all')
 const [drafts,setDrafts]=useState<Record<string,{status:FulfillmentStatus;tracking:string}>>({}),[busy,setBusy]=useState(''),[saved,setSaved]=useState('')
 const load=useCallback(()=>{setError('');shippingService.shipments().then(rows=>{setItems(rows);setDrafts(Object.fromEntries(rows.map(row=>[row.orderId,{status:row.status,tracking:row.trackingCode||''}])))}).catch(reason=>{setItems([]);setError(reason instanceof Error?reason.message:'Não foi possível carregar as encomendas.')})},[])
 useEffect(()=>{load()},[load])
 const rows=useMemo(()=>(items||[]).filter(item=>`${item.buyerName} ${item.buyerEmail} ${item.productName}`.toLowerCase().includes(query.toLowerCase())&&(status==='all'||item.status===status)),[items,query,status])
 const counts=useMemo(()=>Object.fromEntries(STATES.map(state=>[state,(items||[]).filter(item=>item.status===state&&item.orderStatus==='approved').length])) as Record<FulfillmentStatus,number>,[items])
 const save=async(item:Shipment)=>{const draft=drafts[item.orderId];setBusy(item.orderId);setSaved('');setError('');try{await shippingService.updateShipment(item.orderId,draft.status,draft.tracking);setSaved(item.orderId);load()}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível atualizar a encomenda.')}finally{setBusy('')}}
 const exportRows=()=>downloadCsv('encomendas-sphexpay.csv',rows.map(item=>({data:new Date(item.createdAt).toLocaleString('pt-BR'),cliente:item.buyerName,email:item.buyerEmail,produto:item.productName,endereco:line(item),frete:item.rateName||'',status_envio:FULFILLMENT_LABEL[item.status],rastreio:item.trackingCode||'',total:(item.amountCents/100).toFixed(2)})))
 return <section aria-label={uiText('Encomendas')}>
  <div className="report-kpis">{(['pending','preparing','shipped','delivered'] as const).map(state=><Card key={state} className="report-kpi"><span><T>{FULFILLMENT_LABEL[state]}</T></span><strong>{counts[state]||0}</strong></Card>)}</div>
  {error&&<div className="mb-3"><StateMessage title={uiText('Atenção')}><span>{error}</span> <button className="btn" onClick={load}><RotateCcw size={14}/><T> Tentar novamente</T></button></StateMessage></div>}
  <Card><div className="customers-toolbar"><SearchBox value={query} onChange={setQuery} placeholder={uiText('Nome, e-mail ou produto...')}/>
   <select className="input" aria-label={uiText('Filtrar por status do envio')} value={status} onChange={event=>setStatus(event.target.value as typeof status)}><option value="all">{uiText('Todos')}</option>{STATES.map(state=><option key={state} value={state}>{uiText(FULFILLMENT_LABEL[state])}</option>)}</select>
   <button className="btn" disabled={!rows.length} onClick={exportRows}><Download size={16}/><T> Exportar CSV</T></button></div>
   {items===null?<Loading label="Carregando encomendas"/>:rows.length===0?<Empty title={uiText(items.length?'Nenhuma encomenda encontrada':'Nenhuma encomenda ainda')} text={uiText(items.length?'Ajuste a busca ou o filtro.':'Pedidos pagos de produtos físicos com frete aparecem aqui para você enviar.')}/>:
   <div className="grid gap-3 p-4">{rows.map(item=>{const draft=drafts[item.orderId]||{status:item.status,tracking:''},refunded=item.orderStatus!=='approved';return <article key={item.orderId} className="p-4 rounded-[var(--radius-md)] border border-[var(--line)]">
    <div className="flex flex-wrap justify-between gap-2"><div><b>{item.productName}</b> · {item.buyerName}<small className="muted block">{item.buyerEmail} · {shortDate(item.createdAt)} · {formatCents(item.amountCents,item.currency as 'BRL')}{item.shippingCents?` (${uiText('frete')} ${formatCents(item.shippingCents,item.currency as 'BRL')})`:''}</small></div><span className="badge"><T>{refunded?'Venda reembolsada':FULFILLMENT_LABEL[item.status]}</T></span></div>
    <p className="text-sm mt-2"><PackageCheck size={14} className="inline mr-1"/>{item.address.recipient} · {line(item)}{item.rateName?<span className="muted"> · {item.rateName}</span>:null}</p>
    {!refunded&&<div className="flex flex-wrap items-end gap-2 mt-3">
     <label><span className="label"><T>Status do envio</T></span><select className="input" aria-label={`${uiText('Status do envio de')} ${item.buyerName}`} value={draft.status} onChange={event=>setDrafts(current=>({...current,[item.orderId]:{...draft,status:event.target.value as FulfillmentStatus}}))}>{STATES.map(state=><option key={state} value={state}>{uiText(FULFILLMENT_LABEL[state])}</option>)}</select></label>
     <label className="flex-1 min-w-[180px]"><span className="label"><T>Código de rastreio</T></span><input className="input" maxLength={80} value={draft.tracking} onChange={event=>setDrafts(current=>({...current,[item.orderId]:{...draft,tracking:event.target.value}}))} placeholder={uiText('Opcional')}/></label>
     <button className="btn btn-primary" disabled={busy===item.orderId} onClick={()=>void save(item)}><Save size={15}/><T>{busy===item.orderId?' Salvando...':' Salvar'}</T></button>
     {saved===item.orderId&&<span className="muted text-sm" role="status"><T>Atualizado.</T></span>}</div>}
   </article>})}</div>}
  </Card>
  <p className="muted text-xs mt-3"><T>Envie o código de rastreio ao comprador pelo e-mail dele. Vendas de teste não aparecem aqui.</T></p>
 </section>
}
