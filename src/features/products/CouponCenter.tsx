import { useCallback,useEffect,useMemo,useState } from 'react'
import { Link } from 'react-router-dom'
import { Check,Copy,Pause,Pencil,Play,RotateCcw,TicketPercent } from 'lucide-react'
import { T,translate as uiText } from '../../i18n'
import { useAppLocale } from '../../i18n/localeStore'
import { Card,Empty,Loading,SearchBox,StateMessage } from '../../components/ui'
import { formatCents } from '../../lib/currencyFormat'
import { couponCenterService,type CouponSummary } from '../../services/couponCenterService'

const discount=(item:CouponSummary)=>item.discountType==='percentage'?`${(item.discountValue/100).toLocaleString('pt-BR',{maximumFractionDigits:2})}%`:formatCents(item.discountValue,'BRL')
const stateOf=(item:CouponSummary,now=Date.now())=>item.status==='paused'?'Pausado':item.expiresAt&&now>=new Date(item.expiresAt).getTime()?'Expirado':item.totalLimit&&item.usesCount>=item.totalLimit?'Esgotado':item.startsAt&&now<new Date(item.startsAt).getTime()?'Agendado':'Ativo'
const day=(value:string|null)=>value?new Date(value).toLocaleDateString('pt-BR'):'-'

// Todos os cupons do vendedor num só lugar. Criar e editar regras continua no produto.
export function CouponCenter(){useAppLocale(state=>state.locale)
 const [items,setItems]=useState<CouponSummary[]|null>(null),[error,setError]=useState(''),[query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[busy,setBusy]=useState(''),[copied,setCopied]=useState('')
 const load=useCallback(()=>{setError('');couponCenterService.list().then(setItems).catch(reason=>{setItems([]);setError(reason instanceof Error?reason.message:'Não foi possível carregar os cupons.')})},[])
 useEffect(()=>{load()},[load])
 const rows=useMemo(()=>(items||[]).filter(item=>`${item.code} ${item.productName}`.toLowerCase().includes(query.toLowerCase())&&(filter==='all'||stateOf(item)===filter)),[items,query,filter])
 const totals=useMemo(()=>{const list=items||[];return{active:list.filter(item=>stateOf(item)==='Ativo').length,uses:list.reduce((sum,item)=>sum+item.usesCount,0)}},[items])
 const toggle=async(item:CouponSummary)=>{setBusy(item.id);setError('');try{await couponCenterService.setStatus(item.id,item.status==='paused'?'active':'paused');load()}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível atualizar o cupom.')}finally{setBusy('')}}
 const copy=async(code:string)=>{try{await navigator.clipboard.writeText(code);setCopied(code)}catch{setCopied('')}}
 return <section className="customers-page" aria-label={uiText('Cupons')}>
  <header className="reports-section-heading"><h2><T>Cupons</T></h2><p><T>Todos os cupons dos seus produtos. O comprador digita o código no checkout e o desconto é conferido no servidor; o uso só conta quando o pagamento é aprovado.</T></p></header>
  <div className="report-kpis">{([['Cupons',String(items?.length||0)],['Ativos agora',String(totals.active)],['Usos em vendas aprovadas',String(totals.uses)]] as const).map(([label,value])=><Card key={label} className="report-kpi"><span><T>{label}</T></span><strong>{value}</strong></Card>)}</div>
  {error&&<div className="mb-3"><StateMessage title={uiText('Atenção')}><span>{error}</span> <button className="btn" onClick={load}><RotateCcw size={14}/><T> Tentar novamente</T></button></StateMessage></div>}
  <Card><div className="customers-toolbar"><SearchBox value={query} onChange={setQuery} placeholder={uiText('Código ou produto...')}/>
   <select className="input" aria-label={uiText('Filtrar cupons')} value={filter} onChange={event=>setFilter(event.target.value)}>{['all','Ativo','Agendado','Pausado','Expirado','Esgotado'].map(value=><option key={value} value={value}>{uiText(value==='all'?'Todos':value)}</option>)}</select></div>
   {items===null?<Loading label="Carregando cupons"/>:<div className="table-wrap"><table className="table"><caption className="sr-only"><T>Cupons</T></caption><thead><tr><th><T>Código</T></th><th><T>Produto</T></th><th><T>Desconto</T></th><th><T>Usos</T></th><th><T>Validade</T></th><th><T>Status</T></th><th><span className="sr-only"><T>Ações</T></span></th></tr></thead>
    <tbody>{rows.map(item=>{const state=stateOf(item);return <tr key={item.id}><td><b className="flex items-center gap-2"><TicketPercent size={15}/>{item.code}</b></td><td>{item.productName}</td><td>{discount(item)}</td><td>{item.usesCount} / {item.totalLimit??'∞'}</td><td>{day(item.startsAt)} → {day(item.expiresAt)}</td><td><span className={`badge ${state==='Ativo'?'badge-ok':state==='Pausado'||state==='Agendado'?'badge-warn':''}`}><T>{state}</T></span></td>
     <td><div className="flex gap-1"><button className="btn icon-btn" aria-label={`${uiText('Copiar código')} ${item.code}`} onClick={()=>void copy(item.code)}>{copied===item.code?<Check/>:<Copy/>}</button><button className="btn icon-btn" disabled={busy===item.id} aria-label={`${uiText(item.status==='paused'?'Ativar cupom':'Pausar cupom')} ${item.code}`} onClick={()=>void toggle(item)}>{item.status==='paused'?<Play/>:<Pause/>}</button><Link className="btn icon-btn" to={`/app/produtos/${item.productId}/coupons`} aria-label={`${uiText('Editar cupom')} ${item.code}`}><Pencil/></Link></div></td></tr>})}</tbody></table>
    {!rows.length&&<Empty title={uiText(items.length?'Nenhum cupom encontrado':'Nenhum cupom criado')} text={uiText(items.length?'Ajuste a busca ou o filtro.':'Crie cupons na aba Cupons de cada produto.')}/>}</div>}</Card>
 </section>
}
