import { useCallback,useEffect,useMemo,useState } from 'react'
import { ChevronLeft,ChevronRight,Copy,Download,Mail,RotateCcw } from 'lucide-react'
import { T,translate as uiText } from '../../i18n'
import { useAppLocale } from '../../i18n/localeStore'
import { Avatar,Card,Empty,Loading,SearchBox,StateMessage } from '../../components/ui'
import { formatCents } from '../../lib/currencyFormat'
import { downloadCsv,shortDate } from '../../lib/utils'
import { customerService,type AbandonedCheckout,type RealCustomer } from '../../services/customerService'

const PAGE=20
function usePaged<T>(rows:T[]){
 const [page,setPage]=useState(1),pages=Math.max(1,Math.ceil(rows.length/PAGE)),current=Math.min(page,pages)
 return{page:current,pages,setPage,visible:rows.slice((current-1)*PAGE,current*PAGE)}
}
function Pager({count,page,pages,setPage,label}:{count:number;page:number;pages:number;setPage:(value:number)=>void;label:string}){
 return <footer className="customers-pagination"><span>{count} · <T>Página </T>{page}<T> de </T>{pages}</span><div><button className="btn icon-btn" aria-label={`${uiText('Página anterior de')} ${label}`} disabled={page===1} onClick={()=>setPage(page-1)}><ChevronLeft/></button><button className="btn icon-btn" aria-label={`${uiText('Próxima página de')} ${label}`} disabled={page>=pages} onClick={()=>setPage(page+1)}><ChevronRight/></button></div></footer>
}

// Clientes que compraram de verdade (vendas em produção), agrupados por e-mail.
export function RealCustomers(){useAppLocale(state=>state.locale)
 const [items,setItems]=useState<RealCustomer[]|null>(null),[error,setError]=useState(''),[query,setQuery]=useState(''),[filter,setFilter]=useState<'all'|'repeat'|'refunded'>('all')
 const load=useCallback(()=>{setItems(null);setError('');customerService.customers().then(setItems).catch(reason=>{setItems([]);setError(reason instanceof Error?reason.message:'Não foi possível carregar seus clientes.')})},[])
 useEffect(()=>{load()},[load])
 const rows=useMemo(()=>(items||[]).filter(item=>`${item.name} ${item.email}`.toLowerCase().includes(query.toLowerCase())&&(filter==='all'||(filter==='repeat'?item.purchases>1:item.refunded>0))),[items,query,filter])
 const paged=usePaged(rows)
 const totals=useMemo(()=>{const list=items||[];return{count:list.length,repeat:list.filter(item=>item.purchases>1).length,spent:list.reduce((sum,item)=>sum+item.spentCents,0)}},[items])
 const exportRows=()=>downloadCsv('clientes-sphexpay.csv',rows.map(item=>({nome:item.name,email:item.email,compras:item.purchases,total_brl:(item.spentCents/100).toFixed(2),reembolsos:item.refunded,primeira_compra:new Date(item.firstPurchaseAt).toLocaleString('pt-BR'),ultima_compra:new Date(item.lastPurchaseAt).toLocaleString('pt-BR')})))
 return <section className="customers-page" aria-label={uiText('Clientes')}>
  <header className="reports-section-heading"><h2><T>Clientes</T></h2><p><T>Quem comprou de você, com histórico de compras. Vendas de teste não entram.</T></p></header>
  {error&&<div className="mb-3"><StateMessage title={uiText('Clientes indisponíveis')}><span>{error}</span> <button className="btn" onClick={load}><RotateCcw size={14}/><T> Tentar novamente</T></button></StateMessage></div>}
  {items===null?<Loading label="Carregando clientes"/>:<>
   <div className="report-kpis">{([['Clientes',String(totals.count)],['Compraram mais de uma vez',String(totals.repeat)],['Total gasto (R$)',formatCents(totals.spent,'BRL')]] as const).map(([label,value])=><Card key={label} className="report-kpi"><span><T>{label}</T></span><strong>{value}</strong></Card>)}</div>
   <Card><div className="customers-toolbar"><SearchBox value={query} onChange={value=>{setQuery(value);paged.setPage(1)}} placeholder={uiText('Nome ou e-mail...')}/>
    <select className="input" aria-label={uiText('Filtrar clientes')} value={filter} onChange={event=>{setFilter(event.target.value as typeof filter);paged.setPage(1)}}><option value="all">{uiText('Todos')}</option><option value="repeat">{uiText('Recorrentes')}</option><option value="refunded">{uiText('Com reembolso')}</option></select>
    <button className="btn" disabled={!rows.length} onClick={exportRows}><Download size={16}/><T> Exportar CSV</T></button></div>
    <div className="table-wrap"><table className="table"><caption className="sr-only"><T>Clientes</T></caption><thead><tr><th><T>Cliente</T></th><th><T>Compras</T></th><th><T>Total gasto</T></th><th><T>Primeira compra</T></th><th><T>Última compra</T></th><th><span className="sr-only"><T>Ações</T></span></th></tr></thead>
     <tbody>{paged.visible.map(item=><tr key={item.email}><td><div className="flex gap-2 items-center"><Avatar name={item.name||item.email}/><div><b>{item.name||item.email}</b><p className="muted text-[11px]">{item.email}</p></div></div></td><td>{item.purchases}{item.refunded?<p className="muted text-[11px]">{item.refunded} <T>reembolso</T><T>{item.refunded===1?'':'s'}</T></p>:null}</td><td><b>{formatCents(item.spentCents,'BRL')}</b>{item.otherCurrency?<p className="muted text-[11px]"><T>+ compras em outras moedas</T></p>:null}</td><td>{shortDate(item.firstPurchaseAt)}</td><td>{shortDate(item.lastPurchaseAt)}</td><td><a className="btn icon-btn" href={`mailto:${item.email}`} aria-label={`${uiText('Enviar e-mail para')} ${item.email}`}><Mail/></a></td></tr>)}</tbody></table>
     {!rows.length&&<Empty title={uiText(items.length?'Nenhum cliente encontrado':'Nenhum cliente ainda')} text={uiText(items.length?'Ajuste a busca ou o filtro.':'Seus compradores aparecem aqui a partir da primeira venda aprovada.')}/>}</div>
    <Pager count={rows.length} {...paged} label={uiText('clientes')}/></Card></>}
 </section>
}

// Comprador que informou nome e e-mail no checkout e não concluiu o pagamento em 1 hora.
export function AbandonedCheckouts(){useAppLocale(state=>state.locale)
 const [items,setItems]=useState<AbandonedCheckout[]|null>(null),[error,setError]=useState(''),[query,setQuery]=useState(''),[copied,setCopied]=useState('')
 const load=useCallback(()=>{setItems(null);setError('');customerService.abandoned().then(setItems).catch(reason=>{setItems([]);setError(reason instanceof Error?reason.message:'Não foi possível carregar os carrinhos abandonados.')})},[])
 useEffect(()=>{load()},[load])
 const rows=useMemo(()=>(items||[]).filter(item=>`${item.buyerName} ${item.buyerEmail} ${item.productName}`.toLowerCase().includes(query.toLowerCase())),[items,query]),paged=usePaged(rows)
 const lostBrl=useMemo(()=>(items||[]).filter(item=>item.currency==='BRL').reduce((sum,item)=>sum+item.amountCents,0),[items])
 const copy=async(email:string)=>{try{await navigator.clipboard.writeText(email);setCopied(email)}catch{setCopied('')}}
 const exportRows=()=>downloadCsv('carrinhos-abandonados-sphexpay.csv',rows.map(item=>({data:new Date(item.createdAt).toLocaleString('pt-BR'),nome:item.buyerName,email:item.buyerEmail,produto:item.productName,moeda:item.currency,valor:(item.amountCents/100).toFixed(2),situacao:item.status==='declined'?'Pagamento recusado':'Não concluiu'})))
 return <section className="customers-page" aria-label={uiText('Carrinhos abandonados')}>
  <header className="reports-section-heading"><h2><T>Carrinhos abandonados</T></h2><p><T>Compradores que preencheram nome e e-mail e não pagaram em até 1 hora (últimos 90 dias). Use para recuperar a venda com um contato pessoal.</T></p></header>
  {error&&<div className="mb-3"><StateMessage title={uiText('Carrinhos indisponíveis')}><span>{error}</span> <button className="btn" onClick={load}><RotateCcw size={14}/><T> Tentar novamente</T></button></StateMessage></div>}
  {items===null?<Loading label="Carregando carrinhos"/>:<>
   <div className="report-kpis">{([['Carrinhos abandonados',String(items.length)],['Valor não recuperado (R$)',formatCents(lostBrl,'BRL')],['Pagamentos recusados',String(items.filter(item=>item.status==='declined').length)]] as const).map(([label,value])=><Card key={label} className="report-kpi"><span><T>{label}</T></span><strong>{value}</strong></Card>)}</div>
   <Card><div className="customers-toolbar"><SearchBox value={query} onChange={value=>{setQuery(value);paged.setPage(1)}} placeholder={uiText('Nome, e-mail ou produto...')}/><button className="btn" disabled={!rows.length} onClick={exportRows}><Download size={16}/><T> Exportar CSV</T></button></div>
    <div className="table-wrap"><table className="table"><caption className="sr-only"><T>Carrinhos abandonados</T></caption><thead><tr><th><T>Comprador</T></th><th><T>Produto</T></th><th><T>Valor</T></th><th><T>Situação</T></th><th><T>Data</T></th><th><span className="sr-only"><T>Ações</T></span></th></tr></thead>
     <tbody>{paged.visible.map(item=><tr key={item.id}><td><b>{item.buyerName}</b><p className="muted text-[11px]">{item.buyerEmail}</p></td><td>{item.productName}{item.billingType==='subscription'?<p className="muted text-[11px]"><T>Assinatura</T></p>:null}</td><td><b>{formatCents(item.amountCents,item.currency as 'BRL')}</b></td><td><span className="badge"><T>{item.status==='declined'?'Pagamento recusado':'Não concluiu'}</T></span></td><td>{shortDate(item.createdAt)}</td><td><div className="flex gap-1"><button className="btn icon-btn" aria-label={`${uiText('Copiar e-mail de')} ${item.buyerName}`} onClick={()=>void copy(item.buyerEmail)}><Copy/></button><a className="btn icon-btn" href={`mailto:${item.buyerEmail}?subject=${encodeURIComponent(item.productName)}`} aria-label={`${uiText('Enviar e-mail para')} ${item.buyerEmail}`}><Mail/></a></div></td></tr>)}</tbody></table>
     {!rows.length&&<Empty title={uiText(items.length?'Nenhum carrinho encontrado':'Nenhum carrinho abandonado')} text={uiText(items.length?'Ajuste a busca.':'Quando alguém iniciar o pagamento e não concluir, aparece aqui.')}/>}</div>
    {copied&&<p className="muted text-sm px-4" role="status"><T>E-mail copiado.</T></p>}
    <Pager count={rows.length} {...paged} label={uiText('carrinhos')}/></Card></>}
 </section>
}
