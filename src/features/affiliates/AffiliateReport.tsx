import { useCallback,useEffect,useMemo,useState } from 'react'
import { CheckCircle2,Download,RotateCcw,Trophy } from 'lucide-react'
import { T,translate as uiText } from '../../i18n'
import { useAppLocale } from '../../i18n/localeStore'
import { Card,Empty,Loading,StateMessage } from '../../components/ui'
import { PeriodSelector } from '../../components/common/PeriodSelector'
import { formatCents } from '../../lib/currencyFormat'
import { downloadCsv,shortDate } from '../../lib/utils'
import { periodBounds } from '../../services/analyticsService'
import { affiliateReportService,type AffiliateSale } from '../../services/affiliateReportService'
import { useDemoStore } from '../../store/useDemoStore'
import { useActiveSeller } from '../../hooks/useActiveSeller'
import { methodLabel } from '../finance/financeSummary'

const STATUS:Record<string,string>={approved:'Aprovada',refunded:'Reembolsada',chargeback:'Contestada',pending:'Pendente',declined:'Recusada'}
const brl=(cents:number)=>formatCents(cents,'BRL')

// Desempenho dos afiliados e comissões. A comissão é paga pelo vendedor ao afiliado fora da
// SphexPay; aqui ele marca o que já pagou. Reembolso e contestação zeram a comissão.
export function AffiliateReport(){useAppLocale(state=>state.locale)
 const {member}=useActiveSeller(),period=useDemoStore(state=>state.period),bounds=useMemo(()=>periodBounds(period),[period])
 const [items,setItems]=useState<AffiliateSale[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[filter,setFilter]=useState<'all'|'due'|'paid'>('all')
 const load=useCallback(()=>{setItems(null);setError('');affiliateReportService.sales(bounds.start,bounds.end).then(setItems).catch(reason=>{setItems([]);setError(reason instanceof Error?reason.message:'Não foi possível carregar as vendas dos afiliados.')})},[bounds])
 useEffect(()=>{load()},[load])
 const list=useMemo(()=>items||[],[items])
 const approved=useMemo(()=>list.filter(item=>item.status==='approved'),[list])
 const kpis=useMemo(()=>{const brlRows=approved.filter(item=>item.currency==='BRL');return{sold:brlRows.reduce((sum,item)=>sum+item.amountCents,0),sales:approved.length,affiliates:new Set(approved.map(item=>item.affiliateId)).size,due:brlRows.filter(item=>!item.commissionPaidAt).reduce((sum,item)=>sum+item.commissionCents,0),paid:brlRows.filter(item=>item.commissionPaidAt).reduce((sum,item)=>sum+item.commissionCents,0)}},[approved])
 const ranking=useMemo(()=>{const map=new Map<string,{name:string;code:string;sales:number;soldCents:number;commissionCents:number}>();for(const item of approved.filter(row=>row.currency==='BRL')){const entry=map.get(item.affiliateId)||{name:item.affiliateName,code:item.affiliatePublicId,sales:0,soldCents:0,commissionCents:0};entry.sales+=1;entry.soldCents+=item.amountCents;entry.commissionCents+=item.commissionCents;map.set(item.affiliateId,entry)}return[...map.values()].sort((a,b)=>b.soldCents-a.soldCents).slice(0,5)},[approved])
 const rows=useMemo(()=>list.filter(item=>filter==='all'||(item.status==='approved'&&item.commissionCents>0&&(filter==='paid'?Boolean(item.commissionPaidAt):!item.commissionPaidAt))),[list,filter])
 const toggle=async(ids:string[],paid:boolean)=>{setBusy(ids.join(','));setError('');try{await affiliateReportService.setPaid(ids,paid);load()}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível atualizar o pagamento da comissão.')}finally{setBusy('')}}
 const dueIds=approved.filter(item=>!item.commissionPaidAt&&item.commissionCents>0).map(item=>item.orderId)
 const exportRows=()=>downloadCsv('afiliados-sphexpay.csv',rows.map(item=>({data:new Date(item.occurredAt).toLocaleString('pt-BR'),afiliado:item.affiliateName,codigo:item.affiliatePublicId,cliente:item.buyerName,produto:item.productName,metodo:methodLabel(item.paymentMethod),status:STATUS[item.status]||item.status,moeda:item.currency,total:(item.amountCents/100).toFixed(2),comissao:(item.commissionCents/100).toFixed(2),comissao_paga:item.commissionPaidAt?new Date(item.commissionPaidAt).toLocaleDateString('pt-BR'):''})))
 return <section className="customers-page" aria-label={uiText('Relatório de afiliados')}>
  <header className="reports-section-heading"><h2><T>Afiliados</T></h2><p><T>Vendas feitas pelos links dos seus afiliados e as comissões de cada um. Em assinaturas, a comissão vale para a primeira cobrança.</T></p></header>
  <div className="reports-overview-actions"><PeriodSelector/><button className="btn" disabled={!rows.length} onClick={exportRows}><Download size={16}/><T> Exportar CSV</T></button></div>
  {error&&<div className="mb-3"><StateMessage title={uiText('Atenção')}><span>{error}</span> <button className="btn" onClick={load}><RotateCcw size={14}/><T> Tentar novamente</T></button></StateMessage></div>}
  {items===null?<Loading label="Carregando afiliados"/>:<>
   <div className="report-kpis">{([['Total vendido por afiliados',brl(kpis.sold)],['Vendas com afiliado',String(kpis.sales)],['Afiliados com venda',String(kpis.affiliates)],['Comissão a pagar',brl(kpis.due)],['Comissão paga',brl(kpis.paid)]] as const).map(([label,value])=><Card key={label} className="report-kpi"><span><T>{label}</T></span><strong>{value}</strong></Card>)}</div>
   <Card className="p-5 mb-4"><b className="flex items-center gap-2"><Trophy size={16}/><T>Top afiliados</T></b>
    {ranking.length?<ol className="grid gap-2 mt-3">{ranking.map((item,index)=><li key={item.code} className="flex flex-wrap justify-between gap-2 text-sm"><span>{index+1}. <b>{item.name}</b> <span className="muted">{item.code}</span></span><span>{brl(item.soldCents)} · {item.sales} <T>{item.sales===1?'venda':'vendas'}</T> · <T>comissão </T>{brl(item.commissionCents)}</span></li>)}</ol>:<p className="muted text-sm mt-2"><T>Nenhum afiliado com venda aprovada no período.</T></p>}</Card>
   <Card><div className="customers-toolbar"><select className="input" aria-label={uiText('Filtrar comissões')} value={filter} onChange={event=>setFilter(event.target.value as typeof filter)}><option value="all">{uiText('Todas as vendas')}</option><option value="due">{uiText('Comissão a pagar')}</option><option value="paid">{uiText('Comissão paga')}</option></select>
    {!member&&<button className="btn" disabled={!dueIds.length||Boolean(busy)} onClick={()=>void toggle(dueIds,true)}><CheckCircle2 size={15}/><T> Marcar todas como pagas</T></button>}</div>
    <div className="table-wrap"><table className="table"><caption className="sr-only"><T>Vendas realizadas por afiliados</T></caption><thead><tr><th><T>Cliente</T></th><th><T>Afiliado</T></th><th><T>Produto</T></th><th><T>Status</T></th><th><T>Total</T></th><th><T>Comissão</T></th><th><T>Paga ao afiliado</T></th></tr></thead>
     <tbody>{rows.map(item=><tr key={item.orderId}><td><b>{item.buyerName}</b><p className="muted text-[11px]">{shortDate(item.occurredAt)} · {uiText(methodLabel(item.paymentMethod))}</p></td><td>{item.affiliateName}<p className="muted text-[11px]">{item.affiliatePublicId}</p></td><td>{item.productName}</td><td><span className="badge"><T>{STATUS[item.status]||item.status}</T></span></td><td>{formatCents(item.amountCents,item.currency as 'BRL')}</td><td><b>{formatCents(item.commissionCents,item.currency as 'BRL')}</b></td>
      <td>{item.status==='approved'&&item.commissionCents>0?<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(item.commissionPaidAt)} disabled={member||busy.includes(item.orderId)} onChange={event=>void toggle([item.orderId],event.target.checked)} aria-label={`${uiText('Comissão paga a')} ${item.affiliateName}`}/>{item.commissionPaidAt?shortDate(item.commissionPaidAt):''}</label>:<span className="muted">-</span>}</td></tr>)}</tbody></table>
     {!rows.length&&<Empty title={uiText('Nenhuma venda de afiliado')} text={uiText('Cadastre afiliados em Afiliados, vincule produtos e compartilhe o link. As vendas aparecem aqui.')}/>}</div></Card></>}
 </section>
}
