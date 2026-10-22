import { useCallback,useEffect,useMemo,useState,type FormEvent } from 'react'
import { Pencil,Plus,RotateCcw,Trash2,Truck } from 'lucide-react'
import { T,translate as uiText } from '../../i18n'
import { useAppLocale } from '../../i18n/localeStore'
import { Card,Empty,Loading,Modal,SearchBox,StateMessage } from '../../components/ui'
import { formatCents } from '../../lib/currencyFormat'
import { shippingService,type ShippingRate,type ShippingRateInput } from '../../services/shippingService'

const blank:ShippingRateInput={name:'',carrier:'',priceCents:0,minOrderCents:0,deliveryDaysMin:null,deliveryDaysMax:null,active:true}
const toCents=(value:string)=>{const text=value.trim();if(!text)return 0;const clean=!text.includes(',')&&/\.\d{1,2}$/.test(text)?text.replace(/[^\d.]/g,''):text.replace(/[^\d,]/g,'').replace(',','.');const number=Number(clean);return Number.isFinite(number)?Math.round(number*100):NaN}
const money=(cents:number)=>(cents/100).toFixed(2).replace('.',',')
const days=(value:string)=>value.trim()===''?null:Number(value)

// Fretes cobrados no checkout de produtos físicos. Só os ativos aparecem para o comprador.
export function ShippingRatesPage(){useAppLocale(state=>state.locale)
 const [items,setItems]=useState<ShippingRate[]|null>(null),[error,setError]=useState(''),[query,setQuery]=useState(''),[editing,setEditing]=useState<ShippingRate|'new'|null>(null)
 const load=useCallback(()=>{setError('');shippingService.rates().then(setItems).catch(reason=>{setItems([]);setError(reason instanceof Error?reason.message:'Não foi possível carregar os fretes.')})},[])
 useEffect(()=>{load()},[load])
 const rows=useMemo(()=>(items||[]).filter(item=>`${item.name} ${item.carrier}`.toLowerCase().includes(query.toLowerCase())),[items,query])
 const remove=async(item:ShippingRate)=>{if(!window.confirm(`${uiText('Excluir o frete')} "${item.name}"?`))return;try{await shippingService.removeRate(item.id);load()}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível excluir o frete.')}}
 return <section className="customers-page" aria-label={uiText('Fretes')}>
  <header className="reports-section-heading flex flex-wrap items-start justify-between gap-3"><div><h2><T>Fretes</T></h2><p><T>Opções de entrega cobradas no checkout de produtos do tipo Físico. Com um frete ativo, o comprador informa o endereço e escolhe a entrega.</T></p></div><button className="btn btn-primary" onClick={()=>setEditing('new')}><Plus size={15}/><T> Novo frete</T></button></header>
  {error&&<div className="mb-3"><StateMessage title={uiText('Atenção')}><span>{error}</span> <button className="btn" onClick={load}><RotateCcw size={14}/><T> Tentar novamente</T></button></StateMessage></div>}
  <Card><div className="customers-toolbar"><SearchBox value={query} onChange={setQuery} placeholder={uiText('Buscar frete ou transportadora...')}/></div>
   {items===null?<Loading label="Carregando fretes"/>:<div className="table-wrap"><table className="table"><caption className="sr-only"><T>Fretes</T></caption><thead><tr><th><T>Frete</T></th><th><T>Transportadora</T></th><th><T>Status</T></th><th><T>Preço</T></th><th><T>Pedido mínimo</T></th><th><T>Prazo</T></th><th><span className="sr-only"><T>Ações</T></span></th></tr></thead>
    <tbody>{rows.map(item=><tr key={item.id}><td><b>{item.name}</b></td><td>{item.carrier||'-'}</td><td><span className={`badge ${item.active?'badge-ok':''}`}><T>{item.active?'Ativo':'Inativo'}</T></span></td><td>{item.priceCents?formatCents(item.priceCents,'BRL'):uiText('Grátis')}</td><td>{item.minOrderCents?formatCents(item.minOrderCents,'BRL'):'-'}</td><td>{item.deliveryDaysMax!=null?`${item.deliveryDaysMin??item.deliveryDaysMax}-${item.deliveryDaysMax} ${uiText('dias úteis')}`:'-'}</td>
     <td><div className="flex gap-1"><button className="btn icon-btn" aria-label={`${uiText('Editar frete')} ${item.name}`} onClick={()=>setEditing(item)}><Pencil/></button><button className="btn icon-btn" aria-label={`${uiText('Excluir frete')} ${item.name}`} onClick={()=>void remove(item)}><Trash2/></button></div></td></tr>)}</tbody></table>
    {!rows.length&&<Empty title={uiText(items.length?'Nenhum frete encontrado':'Nenhum frete cadastrado')} text={uiText(items.length?'Ajuste a busca.':'Cadastre um frete para vender produtos físicos com entrega.')}/>}</div>}</Card>
  {editing&&<RateEditor rate={editing==='new'?null:editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);load()}}/>}
 </section>
}

function RateEditor({rate,onClose,onSaved}:{rate:ShippingRate|null;onClose:()=>void;onSaved:()=>void}){useAppLocale(state=>state.locale)
 const initial=rate||blank
 const [form,setForm]=useState({name:initial.name,carrier:initial.carrier,price:money(initial.priceCents),minOrder:initial.minOrderCents?money(initial.minOrderCents):'',daysMin:initial.deliveryDaysMin==null?'':String(initial.deliveryDaysMin),daysMax:initial.deliveryDaysMax==null?'':String(initial.deliveryDaysMax),active:initial.active})
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const priceCents=toCents(form.price),minOrderCents=toCents(form.minOrder),daysMin=days(form.daysMin),daysMax=days(form.daysMax)
 const problem=form.name.trim().length<2?'Informe o nome do frete.':!Number.isFinite(priceCents)||priceCents<0?'Informe um preço válido (0 para grátis).':!Number.isFinite(minOrderCents)||minOrderCents<0?'Pedido mínimo inválido.':[daysMin,daysMax].some(value=>value!=null&&(!Number.isInteger(value)||value<0||value>120))?'Prazo deve ser de 0 a 120 dias.':daysMin!=null&&daysMax!=null&&daysMin>daysMax?'O prazo mínimo não pode passar do máximo.':''
 const submit=async(event:FormEvent)=>{event.preventDefault();if(problem)return;setBusy(true);setError('')
  try{await shippingService.saveRate({name:form.name,carrier:form.carrier,priceCents,minOrderCents,deliveryDaysMin:daysMin,deliveryDaysMax:daysMax,active:form.active},rate?.id);onSaved()}
  catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível salvar o frete.')}finally{setBusy(false)}}
 return <Modal title={uiText(rate?'Editar frete':'Novo frete')} onClose={onClose}><form className="grid gap-3" onSubmit={event=>void submit(event)}>
  <div className="grid sm:grid-cols-2 gap-3"><label><span className="label"><T>Nome do frete</T></span><input className="input" maxLength={80} value={form.name} onChange={event=>setForm({...form,name:event.target.value})} placeholder={uiText('Ex.: Entrega padrão')}/></label>
   <label><span className="label"><T>Transportadora</T></span><input className="input" maxLength={80} value={form.carrier} onChange={event=>setForm({...form,carrier:event.target.value})} placeholder={uiText('Opcional')}/></label>
   <label><span className="label"><T>Preço (R$)</T></span><input className="input" inputMode="decimal" value={form.price} onChange={event=>setForm({...form,price:event.target.value})}/></label>
   <label><span className="label"><T>Pedido mínimo (R$)</T></span><input className="input" inputMode="decimal" value={form.minOrder} onChange={event=>setForm({...form,minOrder:event.target.value})} placeholder={uiText('Sem mínimo')}/></label>
   <label><span className="label"><T>Prazo mínimo (dias úteis)</T></span><input className="input" inputMode="numeric" value={form.daysMin} onChange={event=>setForm({...form,daysMin:event.target.value.replace(/\D/g,'')})}/></label>
   <label><span className="label"><T>Prazo máximo (dias úteis)</T></span><input className="input" inputMode="numeric" value={form.daysMax} onChange={event=>setForm({...form,daysMax:event.target.value.replace(/\D/g,'')})}/></label></div>
  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={event=>setForm({...form,active:event.target.checked})}/><T>Ativo no checkout</T></label>
  <p className="muted text-xs"><Truck size={13} className="inline mr-1"/><T>O frete só aparece em pedidos a partir do pedido mínimo. Use preço 0 para frete grátis.</T></p>
  {(error||problem)&&<p className={error?'withdrawal-error':'muted text-sm'} role={error?'alert':undefined}>{error||uiText(problem)}</p>}
  <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}><T>Cancelar</T></button><button className="btn btn-primary" disabled={busy||Boolean(problem)}><T>{busy?'Salvando...':'Salvar frete'}</T></button></div>
 </form></Modal>
}
