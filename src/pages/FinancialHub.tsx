import {translate as uiText} from '../i18n'
import {useAppLocale} from '../i18n/localeStore'
import {T} from '../i18n'
import {useMemo} from 'react'
import {NavLink,Outlet,useLocation} from 'react-router-dom'
import {BadgePercent,CalendarDays,Download,Landmark,RotateCcw,Send,TrendingUp,WalletCards} from 'lucide-react'
import {Card,Empty,Loading,PageTitle,StateMessage,StatusBadge} from '../components/ui'
import {PeriodSelector} from '../components/common/PeriodSelector'
import {StripeConnectCard} from '../components/finance/StripeConnectCard'
import {KycStatusNotice} from '../features/kyc/KycStatusNotice'
import {balanceFor,buildLedger,centsMoney,ledgerCsv,summarizeTransactions} from '../features/finance/financeSummary'
import {useFinanceData} from '../features/finance/useFinanceData'
import {useActiveSeller} from '../hooks/useActiveSeller'
import {downloadCsv,shortDate} from '../lib/utils'

export default function FinancialHub(){useAppLocale(state=>state.locale);
 const {pathname}=useLocation(),withdrawalsActive=pathname.endsWith('/saques'),chargesActive=pathname.endsWith('/cobrancas'),feesActive=pathname.endsWith('/taxas')
 return <div className="financial-module page-enter"><PageTitle title={uiText("Financeiro")} subtitle={uiText("Saldos, repasses, extrato, cobranças e taxas da operação.")}/><nav className="financial-module-tabs" aria-label={uiText("Áreas do Financeiro")} role="tablist"><NavLink end to="/app/financeiro" role="tab" aria-selected={!withdrawalsActive&&!chargesActive&&!feesActive}><Landmark/><T> Visão geral</T></NavLink><NavLink to="/app/financeiro/saques" role="tab" aria-selected={withdrawalsActive}><WalletCards/><T> Saques</T></NavLink><NavLink to="/app/financeiro/cobrancas" role="tab" aria-selected={chargesActive}><Send/><T> Cobranças</T></NavLink><NavLink to="/app/financeiro/taxas" role="tab" aria-selected={feesActive}><BadgePercent/><T> Minhas taxas</T></NavLink></nav><Outlet/></div>
}

export function FinancialOverview(){useAppLocale(state=>state.locale);
 const {bounds,transactions,transactionsError,finance,financeError,financeLoading,reload}=useFinanceData()
 const summary=useMemo(()=>summarizeTransactions(transactions||[]),[transactions])
 const ledger=useMemo(()=>buildLedger(transactions||[],finance?.payouts||[],bounds),[transactions,finance,bounds])
 const connected=Boolean(finance?.connected),balance=(value:number)=>financeLoading?'...':connected?centsMoney(value):'—'
 const cards=[
  ['Disponível',balance(balanceFor(finance?.balance.available)),WalletCards,'Saldo na Stripe pronto para o próximo repasse.'],
  ['Saldo futuro',balance(balanceFor(finance?.balance.pending)),CalendarDays,'Vendas aprovadas aguardando liberação da Stripe.'],
  ['Vendas líquidas no período',transactions?centsMoney(summary.netCents):'...',TrendingUp,`${summary.approvedCount} ${summary.approvedCount===1?'venda aprovada':'vendas aprovadas'}`],
  ['Taxas no período',transactions?centsMoney(summary.feesCents):'...',Landmark,'Taxa da plataforma descontada das vendas.']
 ] as const
 // Verificação e conta Stripe são de quem é dono; o colaborador só lê os números.
 const {member}=useActiveSeller()
 return <section className="financial-page" aria-label={uiText("Visão geral financeira")}>
  <div className="financial-overview-actions"><PeriodSelector/><button className="btn" disabled={!ledger.length} onClick={()=>downloadCsv('extrato-sphexpay.csv',ledgerCsv(ledger))}><Download size={16}/><T> Exportar extrato</T></button></div>
  {!member&&<><KycStatusNotice/><StripeConnectCard/></>}
  {(transactionsError||financeError)&&<div className="mb-4"><StateMessage title={uiText('Alguns dados não carregaram')}><span>{transactionsError||financeError}</span> <button className="btn" onClick={reload}><RotateCcw size={14}/><T> Tentar novamente</T></button></StateMessage></div>}
  {finance?.mode==='test'&&connected&&<p className="muted text-xs mb-3"><T>Ambiente de teste da Stripe: saldo e repasses abaixo não são dinheiro real.</T></p>}
  <div className="financial-balance-grid grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">{cards.map(([label,value,Icon,hint])=><Card className="financial-balance-card p-5" key={label}><Icon size={19} className="orange mb-4"/><span className="label"><T>{label}</T></span><b className="text-xl financial-money">{value}</b><small className="muted text-xs block mt-1"><T>{hint}</T></small></Card>)}</div>
  {(summary.refundedCount>0||summary.chargebackCount>0)&&<p className="muted text-xs mb-4"><T>No período: </T>{summary.refundedCount}<T> reembolso(s) somando </T>{centsMoney(summary.refundedCents)}<T> e </T>{summary.chargebackCount}<T> contestação(ões) somando </T>{centsMoney(summary.chargebackCents)}.</p>}
  <Card className="financial-ledger-card"><div className="p-5 border-b border-[var(--line)]"><b><T>Histórico financeiro</T></b></div>
   {transactions===null?<Loading label="Carregando extrato"/>:ledger.length===0?<Empty title={uiText('Nenhuma movimentação no período')} text={uiText('Vendas aprovadas, reembolsos e repasses aparecem aqui assim que acontecerem.')}/>:
   <div className="table-wrap"><table className="table"><thead><tr><th><T>Data</T></th><th><T>Descrição</T></th><th><T>Tipo</T></th><th><T>Status</T></th><th><T>Valor</T></th></tr></thead><tbody>{ledger.map(row=><tr key={`${row.type}-${row.id}`}><td>{shortDate(row.date)}</td><td>{row.description}</td><td><T>{row.type}</T></td><td><StatusBadge status={row.status}/></td><td className={`font-bold financial-money ${!row.affectsBalance?'muted':row.amountCents<0?'text-red-500':'text-emerald-600'}`}>{row.amountCents<0?`- ${centsMoney(-row.amountCents,row.currency)}`:centsMoney(row.amountCents,row.currency)}</td></tr>)}</tbody></table></div>}
  </Card>
  <p className="muted text-xs mt-4"><T>Somente vendas reais aprovadas entram no extrato. Os repasses são feitos pela Stripe para a conta bancária cadastrada.</T>{summary.otherCurrencies.length?<> <T>Totais em reais; vendas em outras moedas aparecem no extrato.</T></>:null}</p>
 </section>
}
