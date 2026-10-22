import { useCallback,useEffect,useMemo,useState } from 'react'
import { Check,Copy,Gift,RotateCcw,Save,Trophy } from 'lucide-react'
import { T,translate as uiText } from '../../i18n'
import { useAppLocale } from '../../i18n/localeStore'
import { Card,Empty,Loading,StateMessage } from '../../components/ui'
import { PeriodSelector } from '../../components/common/PeriodSelector'
import { useAuth } from '../../hooks/useAuth'
import { useDashboardAdmin } from '../../hooks/useDashboardAdmin'
import { formatCents } from '../../lib/currencyFormat'
import { shortDate } from '../../lib/utils'
import { periodBounds } from '../../services/analyticsService'
import { referralService,type AdminReferralRow,type ReferralSale,type ReferralSummary } from '../../services/referralService'
import { useDemoStore } from '../../store/useDemoStore'

const brl=(cents:number)=>formatCents(cents,'BRL')

// Indicações: quem indica recebe 10% da taxa SphexPay das vendas aprovadas do indicado por 12
// meses. A comissão sai da taxa da plataforma e é paga pela equipe uma vez por mês.
export function ReferralReport(){useAppLocale(state=>state.locale)
 const period=useDemoStore(state=>state.period),bounds=useMemo(()=>periodBounds(period),[period]),admin=useDashboardAdmin(useAuth().user?.id)
 const [code,setCode]=useState(''),[summary,setSummary]=useState<ReferralSummary|null>(null),[sales,setSales]=useState<ReferralSale[]|null>(null),[error,setError]=useState(''),[copied,setCopied]=useState(false)
 const link=code?`${typeof location==='undefined'?'':location.origin}/criar-conta?indicacao=${code}`:''
 const load=useCallback(()=>{setError('');setSales(null)
  Promise.all([referralService.code(),referralService.summary(),referralService.sales(bounds.start,bounds.end)]).then(([value,info,rows])=>{setCode(value);setSummary(info);setSales(rows)}).catch(reason=>{setSales([]);setError(reason instanceof Error?reason.message:'Não foi possível carregar suas indicações.')})},[bounds])
 useEffect(()=>{load()},[load])
 const list=useMemo(()=>sales||[],[sales])
 const totals=useMemo(()=>{const brlRows=list.filter(item=>item.currency==='BRL');return{sold:brlRows.reduce((sum,item)=>sum+item.amountCents,0),commission:brlRows.reduce((sum,item)=>sum+item.commissionCents,0),sellers:new Set(list.map(item=>item.referredId)).size}},[list])
 const ranking=useMemo(()=>{const map=new Map<string,{name:string;since:string;sales:number;soldCents:number;commissionCents:number}>();for(const item of list.filter(row=>row.currency==='BRL')){const entry=map.get(item.referredId)||{name:item.referredName,since:item.referredSince,sales:0,soldCents:0,commissionCents:0};entry.sales+=1;entry.soldCents+=item.amountCents;entry.commissionCents+=item.commissionCents;map.set(item.referredId,entry)}return[...map.values()].sort((a,b)=>b.commissionCents-a.commissionCents).slice(0,10)},[list])
 const copy=async()=>{try{await navigator.clipboard.writeText(link);setCopied(true)}catch{setCopied(false)}}
 return <section className="customers-page" aria-label={uiText('Indicações')}>
  <header className="reports-section-heading"><h2><T>Indicações</T></h2><p><T>Indique outros vendedores e receba 10% da taxa SphexPay de cada venda aprovada deles durante 12 meses. O valor sai da taxa da plataforma: quem você indica não paga nada a mais. A SphexPay paga uma vez por mês.</T></p></header>
  <Card className="p-5 mb-4"><b className="flex items-center gap-2"><Gift size={16}/><T>Seu link de indicação</T></b>
   <div className="flex items-center gap-2 mt-3"><code className="input flex items-center truncate">{link||uiText('Carregando…')}</code><button className="btn icon-btn" disabled={!link} aria-label={uiText('Copiar link de indicação')} onClick={()=>void copy()}>{copied?<Check/>:<Copy/>}</button></div>
   <small className="muted block mt-2"><T>Vale para contas novas criadas por este link. Autoindicação não conta.</T></small></Card>
  <div className="reports-overview-actions"><PeriodSelector/></div>
  {error&&<div className="mb-3"><StateMessage title={uiText('Atenção')}><span>{error}</span> <button className="btn" onClick={load}><RotateCcw size={14}/><T> Tentar novamente</T></button></StateMessage></div>}
  {sales===null?<Loading label="Carregando indicações"/>:<>
   <div className="report-kpis">{([['Total vendido pelos indicados',brl(totals.sold)],['Vendas com comissão',String(list.length)],['Indicados com venda',String(totals.sellers)],['Comissão no período',brl(totals.commission)],['Comissão já paga',brl(summary?.paidCents||0)],['Vendedores indicados',`${summary?.active||0} / ${summary?.referred||0}`]] as const).map(([label,value])=><Card key={label} className="report-kpi"><span><T>{label}</T></span><strong>{value}</strong></Card>)}</div>
   <Card className="p-5 mb-4"><b className="flex items-center gap-2"><Trophy size={16}/><T>Top indicados</T></b>
    {ranking.length?<ol className="grid gap-2 mt-3">{ranking.map((item,index)=><li key={`${item.name}-${index}`} className="flex flex-wrap justify-between gap-2 text-sm"><span>{index+1}. <b>{item.name}</b> <span className="muted"><T>desde </T>{new Date(item.since).toLocaleDateString('pt-BR')}</span></span><span>{brl(item.soldCents)} · {item.sales} <T>{item.sales===1?'venda':'vendas'}</T> · <T>comissão </T>{brl(item.commissionCents)}</span></li>)}</ol>:<Empty title={uiText('Nenhuma comissão no período')} text={uiText('Compartilhe seu link. As vendas dos vendedores indicados aparecem aqui.')}/>}</Card>
   {summary&&summary.payouts.length>0&&<Card className="p-5 mb-4"><b><T>Pagamentos recebidos</T></b><ul className="grid gap-1 mt-2 text-sm">{summary.payouts.map(item=><li key={item.month} className="flex justify-between"><span>{new Date(`${item.month}T12:00:00`).toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</span><b>{brl(item.amountCents)}</b></li>)}</ul></Card>}
  </>}
  {admin.allowed&&<ReferralAdminPanel/>}
 </section>
}

const monthValue=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-01`
// Equipe: comissão de cada indicador no mês e registro do pagamento feito.
function ReferralAdminPanel(){useAppLocale(state=>state.locale)
 const [month,setMonth]=useState(()=>{const now=new Date();return monthValue(new Date(now.getFullYear(),now.getMonth()-1,1))}),[rows,setRows]=useState<AdminReferralRow[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState('')
 const load=useCallback(()=>{setRows(null);setError('');referralService.adminMonth(month).then(setRows).catch(reason=>{setRows([]);setError(reason instanceof Error?reason.message:'Não foi possível carregar as comissões.')})},[month])
 useEffect(()=>{load()},[load])
 const pay=async(row:AdminReferralRow)=>{setBusy(row.referrerId);setError('');try{await referralService.adminMarkPaid(row.referrerId,month,row.commissionCents);load()}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível registrar o pagamento.')}finally{setBusy('')}}
 return <section className="mt-8" aria-label={uiText('Pagamentos de indicação (equipe)')}>
  <div className="flex flex-wrap items-end justify-between gap-3 mb-3"><div><h2 className="text-lg font-semibold"><T>Pagamentos de indicação (equipe)</T></h2><p className="muted text-sm"><T>Visível só para administradores. Pague por Pix ou transferência e registre aqui.</T></p></div>
   <label><span className="label"><T>Mês</T></span><input className="input" type="month" value={month.slice(0,7)} onChange={event=>event.target.value&&setMonth(`${event.target.value}-01`)}/></label></div>
  {error&&<div className="mb-3"><StateMessage title={uiText('Atenção')}><span>{error}</span></StateMessage></div>}
  <Card>{rows===null?<Loading label="Carregando comissões"/>:rows.length===0?<Empty title={uiText('Nada a pagar neste mês')} text={uiText('Nenhum indicado teve venda aprovada no mês escolhido.')}/>:
   <div className="table-wrap"><table className="table"><caption className="sr-only"><T>Comissões de indicação do mês</T></caption><thead><tr><th><T>Indicador</T></th><th><T>Vendas</T></th><th><T>Comissão (R$)</T></th><th><T>Pago</T></th><th><span className="sr-only"><T>Ações</T></span></th></tr></thead>
    <tbody>{rows.map(row=><tr key={row.referrerId}><td><b>{row.referrerName||row.referrerEmail}</b><p className="muted text-[11px]">{row.referrerEmail}</p></td><td>{row.sales}</td><td><b>{brl(row.commissionCents)}</b></td><td>{row.paidAt?<>{brl(row.paidCents||0)}<p className="muted text-[11px]">{shortDate(row.paidAt)}</p></>:<span className="muted">-</span>}</td>
     <td><button className="btn" disabled={busy===row.referrerId||row.commissionCents<=0||row.paidCents===row.commissionCents} onClick={()=>void pay(row)}><Save size={14}/><T>{row.paidAt?' Atualizar pagamento':' Marcar como pago'}</T></button></td></tr>)}</tbody></table></div>}</Card>
 </section>
}
