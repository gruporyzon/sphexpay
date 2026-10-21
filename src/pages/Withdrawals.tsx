import {translate as uiText} from '../i18n'
import {useAppLocale} from '../i18n/localeStore'
import {T} from '../i18n'
import { CalendarClock,ExternalLink,Landmark,RotateCcw,WalletCards } from 'lucide-react'
import { useCallback,useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { Card,Loading,StateMessage } from '../components/ui'
import { PAYOUT_STATUS_LABEL,balanceFor,centsMoney,scheduleLabel } from '../features/finance/financeSummary'
import { stripeConnectService,type StripeConnectFinance,type StripePayout } from '../services/stripeConnectService'

// Os saques da SphexPay são repasses automáticos da Stripe: o saldo liberado vai
// para a conta bancária que o vendedor cadastrou no onboarding, na agenda da conta.
const STRIPE_DASHBOARD='https://dashboard.stripe.com/settings/payouts'
const DOT:Record<StripePayout['status'],string>={paid:'completed',in_transit:'processing',pending:'requested',failed:'failed',canceled:'cancelled'}
const day=(value:string|null)=>value?new Date(value).toLocaleDateString('pt-BR'):'—'

export default function WithdrawalsSection(){useAppLocale(state=>state.locale);
 const [finance,setFinance]=useState<StripeConnectFinance|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true)
 const load=useCallback(()=>{setLoading(true);setError('');stripeConnectService.finance().then(setFinance).catch(reason=>{setFinance(null);setError(reason instanceof Error?reason.message:'Não foi possível consultar seus repasses agora.')}).finally(()=>setLoading(false))},[])
 useEffect(()=>{load()},[load])
 const upcoming=finance?.payouts.find(item=>item.status==='pending'||item.status==='in_transit')
 const delay=finance?.schedule?.delayDays

 return <section className="withdrawals-secure" aria-label={uiText("Saques")}><header className="financial-section-heading"><h2><T>Saques</T></h2><p><T>Repasses automáticos da Stripe para a sua conta bancária.</T></p></header>
 {loading?<Loading label="Carregando repasses"/>:error?<StateMessage title={uiText('Repasses indisponíveis')}><span>{error}</span> <button className="btn" onClick={load}><RotateCcw size={14}/><T> Tentar novamente</T></button></StateMessage>:
 !finance?.connected?<Card className="withdrawal-request-card"><div className="withdrawal-balance-icon"><Landmark/></div><b><T>Ative seus recebimentos</T></b><p className="muted text-sm mt-2"><T>Conecte sua conta de pagamentos para receber os repasses das suas vendas direto na sua conta bancária.</T></p><Link className="btn btn-primary" to="/app/financeiro"><T>Configurar recebimentos</T></Link></Card>:
 <div className="withdrawal-layout"><Card className="withdrawal-request-card"><div className="withdrawal-balance-icon"><WalletCards/></div><span className="label"><T>Disponível para repasse</T></span><p>{centsMoney(balanceFor(finance.balance.available))}</p>
  {finance.mode==='test'&&<span className="withdrawal-test-badge"><T>AMBIENTE DE TESTE</T></span>}
  <dl className="grid gap-3 text-sm mt-2">
   <div><dt className="label"><T>Saldo futuro</T></dt><dd><b>{centsMoney(balanceFor(finance.balance.pending))}</b></dd></div>
   <div><dt className="label"><T>Agenda de repasses</T></dt><dd><b><CalendarClock size={14} className="inline mr-1"/><T>{scheduleLabel(finance.schedule)}</T></b>{delay!=null&&<small className="muted block"><T>Cada venda fica disponível </T>{delay}<T> dia(s) após a aprovação.</T></small>}</dd></div>
   <div><dt className="label"><T>Próximo repasse</T></dt><dd>{upcoming?<b>{centsMoney(upcoming.amountCents,upcoming.currency)} · {day(upcoming.arrivalDate)}</b>:<span className="muted"><T>Nenhum repasse programado</T></span>}</dd></div>
  </dl>
  {!finance.payoutsEnabled&&<p className="withdrawal-error" role="alert"><T>A Stripe ainda não liberou repasses para esta conta. Conclua as pendências da verificação para receber.</T></p>}
  <a className="btn" href={STRIPE_DASHBOARD} target="_blank" rel="noreferrer"><ExternalLink size={15}/><T> Alterar conta ou agenda na Stripe</T></a>
  <p className="withdrawal-notification-notice"><T>Os repasses são automáticos. Não é preciso solicitar saque.</T></p></Card>
 <Card className="withdrawal-history-card"><header><div><b><T>Histórico de repasses</T></b><span><T>Últimos repasses enviados pela Stripe para sua conta.</T></span></div></header>{finance.payouts.length?<div className="withdrawal-history-list">{finance.payouts.map(item=><article key={item.id}><div className="withdrawal-history-main"><span className={`withdrawal-status-dot ${DOT[item.status]}`}/><div><b>{centsMoney(item.amountCents,item.currency)}</b><small>{item.destination?.last4?<><T>Conta final </T>{item.destination.last4}</>:<T>Conta bancária cadastrada</T>}{item.destination?.bankName?` · ${item.destination.bankName}`:''}</small></div></div><dl><div><dt><T>Criado em</T></dt><dd>{day(item.createdAt)}</dd></div><div><dt><T>Chegada</T></dt><dd>{day(item.arrivalDate)}</dd></div><div><dt><T>Status</T></dt><dd><T>{PAYOUT_STATUS_LABEL[item.status]}</T></dd></div></dl>{item.failureMessage&&<p className="withdrawal-error">{item.failureMessage}</p>}</article>)}</div>:<div className="withdrawal-state"><Landmark/><p><T>Nenhum repasse ainda. Assim que houver saldo disponível, a Stripe envia automaticamente.</T></p></div>}</Card></div>}
 </section>
}
