import { useCallback,useEffect,useMemo,useState,type FormEvent } from 'react'
import { Ban,Copy,ExternalLink,RotateCcw,Send } from 'lucide-react'
import { T,translate as uiText } from '../../i18n'
import { useAppLocale } from '../../i18n/localeStore'
import { useActiveSeller } from '../../hooks/useActiveSeller'
import { Card,Empty,Loading,StateMessage } from '../../components/ui'
import { formatCents } from '../../lib/currencyFormat'
import { shortDate } from '../../lib/utils'
import { customChargeService } from '../../services/customChargeService'
import { stripeConnectService,type CustomCharge,type CustomChargeStatus } from '../../services/stripeConnectService'

const STATUS:Record<CustomChargeStatus,string>={creating:'Criando',open:'Aguardando pagamento',paid:'Paga',void:'Cancelada',failed:'Não enviada'}
const TONE:Record<CustomChargeStatus,string>={creating:'',open:'badge-warn',paid:'badge-ok',void:'',failed:'badge-bad'}
const METHOD_LABEL={card:'Cartão',pix:'Pix',boleto:'Boleto'} as const
// Aceita 1.234,56 (padrão brasileiro) e também 1234.56.
const cents=(value:string)=>{const text=value.trim(),decimalDot=!text.includes(',')&&/\.\d{1,2}$/.test(text),clean=decimalDot?text.replace(/[^\d.]/g,''):text.replace(/[^\d,]/g,'').replace(',','.');const number=Number(clean);return Number.isFinite(number)?Math.round(number*100):0}
const newKey=()=>crypto.randomUUID()

// Cobrança avulsa: a Stripe envia o e-mail com o link de pagamento para o cliente.
export function CustomChargesSection(){useAppLocale(state=>state.locale)
 // Colaborador do financeiro só acompanha: criar e cancelar cobrança fica com o dono.
 const {member}=useActiveSeller()
 const [items,setItems]=useState<CustomCharge[]|null>(null),[listError,setListError]=useState('')
 const [form,setForm]=useState({customerName:'',customerEmail:'',description:'',amount:'',dueDays:'3'}),[methods,setMethods]=useState<CustomCharge['methods']>(['pix','boleto','card'])
 const [requestKey,setRequestKey]=useState(newKey),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState<CustomCharge|null>(null),[working,setWorking]=useState(''),[copied,setCopied]=useState('')
 const load=useCallback(()=>{setListError('');customChargeService.list().then(setItems).catch(reason=>{setItems([]);setListError(reason instanceof Error?reason.message:'Não foi possível carregar suas cobranças.')})},[])
 useEffect(()=>{load()},[load])
 const amountCents=cents(form.amount)
 const valid=form.customerName.trim().length>=2&&/^\S+@\S+\.\S+$/.test(form.customerEmail.trim())&&form.description.trim().length>=2&&amountCents>=50&&methods.length>0
 const totals=useMemo(()=>{const list=items||[];return{open:list.filter(item=>item.status==='open').reduce((sum,item)=>sum+item.amountCents,0),paid:list.filter(item=>item.status==='paid').reduce((sum,item)=>sum+item.amountCents,0),count:list.length}},[items])
 const submit=async(event:FormEvent)=>{
  event.preventDefault();if(!valid)return
  setBusy(true);setError('');setSent(null)
  try{
   const charge=await stripeConnectService.createCharge({requestKey,customerName:form.customerName.trim(),customerEmail:form.customerEmail.trim(),description:form.description.trim(),amountCents,methods,dueDays:Number(form.dueDays)})
   setSent(charge);setForm({customerName:'',customerEmail:'',description:'',amount:'',dueDays:form.dueDays});setRequestKey(newKey());load()
  }catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível criar a cobrança.')}
  finally{setBusy(false)}
 }
 const cancel=async(item:CustomCharge)=>{setWorking(item.id);setListError('');try{await stripeConnectService.voidCharge(item.id);load()}catch(reason){setListError(reason instanceof Error?reason.message:'Não foi possível cancelar a cobrança.')}finally{setWorking('')}}
 const copy=async(item:CustomCharge)=>{if(!item.hostedUrl)return;try{await navigator.clipboard.writeText(item.hostedUrl);setCopied(item.id)}catch{setCopied('')}}
 const toggle=(method:CustomCharge['methods'][number])=>setMethods(current=>current.includes(method)?current.filter(item=>item!==method):[...current,method])
 return <section aria-label={uiText('Cobranças')}><header className="financial-section-heading"><h2><T>Cobranças</T></h2><p><T>Cobre um cliente avulso. A Stripe envia o e-mail com o link para pagar por Pix, boleto ou cartão.</T></p></header>
  <div className={member?'grid gap-4':'grid lg:grid-cols-[380px_1fr] gap-4'}>
   {!member&&<Card className="p-5"><form className="grid gap-3" onSubmit={event=>void submit(event)}>
    <b><T>Nova cobrança</T></b>
    <label><span className="label"><T>Nome do cliente</T></span><input className="input" maxLength={120} value={form.customerName} onChange={event=>setForm({...form,customerName:event.target.value})} required/></label>
    <label><span className="label"><T>E-mail do cliente</T></span><input className="input" type="email" maxLength={254} value={form.customerEmail} onChange={event=>setForm({...form,customerEmail:event.target.value})} required/></label>
    <label><span className="label"><T>Descrição</T></span><input className="input" maxLength={200} value={form.description} onChange={event=>setForm({...form,description:event.target.value})} placeholder={uiText('Ex.: Mentoria individual de outubro')} required/></label>
    <div className="grid grid-cols-2 gap-3"><label><span className="label"><T>Valor (R$)</T></span><input className="input" inputMode="decimal" value={form.amount} onChange={event=>setForm({...form,amount:event.target.value})} placeholder="0,00" required/></label>
     <label><span className="label"><T>Vence em</T></span><select className="input" value={form.dueDays} onChange={event=>setForm({...form,dueDays:event.target.value})}>{[1,3,5,7,15,30].map(days=><option key={days} value={days}>{days} {uiText(days===1?'dia':'dias')}</option>)}</select></label></div>
    <fieldset className="grid gap-2"><legend className="label"><T>Formas de pagamento</T></legend><div className="flex flex-wrap gap-3">{(['pix','boleto','card'] as const).map(method=><label key={method} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={methods.includes(method)} onChange={()=>toggle(method)}/><T>{METHOD_LABEL[method]}</T></label>)}</div></fieldset>
    <p className="muted text-xs"><T>Boleto a partir de R$ 5,00. Cada método precisa estar ativo na sua conta Stripe. A taxa SphexPay é a mesma das vendas.</T></p>
    {error&&<StateMessage title={uiText('Cobrança não enviada')}><span>{error}</span></StateMessage>}
    {sent&&<StateMessage tone="success" title={uiText('Cobrança enviada')}><span><T>A Stripe enviou o link para </T>{sent.customerEmail}.</span></StateMessage>}
    <button className="btn btn-primary" type="submit" disabled={!valid||busy}><Send size={15}/><T>{busy?' Enviando...':' Enviar cobrança'}</T></button>
   </form></Card>}
   <div>
    <div className="report-kpis">{([['Em aberto',formatCents(totals.open,'BRL')],['Recebido',formatCents(totals.paid,'BRL')],['Cobranças',String(totals.count)]] as const).map(([label,value])=><Card key={label} className="report-kpi"><span><T>{label}</T></span><strong>{value}</strong></Card>)}</div>
    {listError&&<div className="mb-3"><StateMessage title={uiText('Atenção')}><span>{listError}</span> <button className="btn" onClick={load}><RotateCcw size={14}/><T> Tentar novamente</T></button></StateMessage></div>}
    <Card>{items===null?<Loading label="Carregando cobranças"/>:items.length===0?<Empty title={uiText('Nenhuma cobrança ainda')} text={uiText('As cobranças enviadas aparecem aqui com o status do pagamento.')}/>:
     <div className="table-wrap"><table className="table"><caption className="sr-only"><T>Cobranças</T></caption><thead><tr><th><T>Cliente</T></th><th><T>Descrição</T></th><th><T>Valor</T></th><th><T>Status</T></th><th><T>Vencimento</T></th><th><span className="sr-only"><T>Ações</T></span></th></tr></thead>
      <tbody>{items.map(item=><tr key={item.id}><td><b>{item.customerName}</b><p className="muted text-[11px]">{item.customerEmail}</p></td><td>{item.description}<p className="muted text-[11px]">{item.methods.map(method=>uiText(METHOD_LABEL[method])).join(' · ')}{item.mode==='test'?` · ${uiText('teste')}`:''}</p></td><td><b>{formatCents(item.amountCents,'BRL')}</b></td><td><span className={`badge ${TONE[item.status]}`}><T>{STATUS[item.status]}</T></span>{item.paidAt?<p className="muted text-[11px]">{shortDate(item.paidAt)}</p>:null}</td><td>{new Date(`${item.dueDate}T12:00:00`).toLocaleDateString('pt-BR')}</td>
       <td><div className="flex gap-1">{item.hostedUrl&&<><button className="btn icon-btn" aria-label={`${uiText('Copiar link da cobrança de')} ${item.customerName}`} onClick={()=>void copy(item)}><Copy/></button><a className="btn icon-btn" href={item.hostedUrl} target="_blank" rel="noreferrer" aria-label={`${uiText('Abrir cobrança de')} ${item.customerName}`}><ExternalLink/></a></>}{item.status==='open'&&!member&&<button className="btn icon-btn" disabled={working===item.id} aria-label={`${uiText('Cancelar cobrança de')} ${item.customerName}`} onClick={()=>void cancel(item)}><Ban/></button>}</div>{copied===item.id&&<small className="muted" role="status"><T>Link copiado.</T></small>}</td></tr>)}</tbody></table></div>}</Card>
   </div>
  </div>
 </section>
}
