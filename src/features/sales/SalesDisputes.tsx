import { useCallback,useEffect,useState } from 'react'
import { ExternalLink,RotateCcw,ShieldAlert } from 'lucide-react'
import { T,translate as uiText } from '../../i18n'
import { useAppLocale } from '../../i18n/localeStore'
import { Card,Empty,Loading,StateMessage } from '../../components/ui'
import { formatCents } from '../../lib/currencyFormat'
import { shortDate } from '../../lib/utils'
import { stripeConnectService,type StripeDispute,type StripeDisputeStatus } from '../../services/stripeConnectService'

const DISPUTE_STATUS_LABEL:Record<StripeDisputeStatus,string>={warning_needs_response:'Alerta: responder',warning_under_review:'Alerta em análise',warning_closed:'Alerta encerrado',needs_response:'Aguardando sua resposta',under_review:'Em análise pelo banco',won:'Ganha',lost:'Perdida',prevented:'Evitada'}
const REASON_LABEL:Record<string,string>={fraudulent:'Fraude',duplicate:'Cobrança duplicada',product_not_received:'Produto não recebido',product_unacceptable:'Produto não aceitável',subscription_canceled:'Assinatura cancelada',unrecognized:'Não reconhecida',credit_not_processed:'Reembolso não processado',general:'Geral',bank_cannot_process:'Banco não processou',customer_initiated:'Iniciada pelo cliente',incorrect_account_details:'Dados bancários incorretos',insufficient_funds:'Saldo insuficiente',debit_not_authorized:'Débito não autorizado',check_returned:'Devolvido',noncompliant:'Fora das regras'}
const open=(status:StripeDisputeStatus)=>status==='needs_response'||status==='warning_needs_response'

// Contestações de cartão (chargeback) e devoluções Pix (MED) da conta Stripe do vendedor.
// A resposta com provas é enviada no painel da Stripe; Pix MED não aceita contestação.
export function SalesDisputes(){useAppLocale(state=>state.locale)
 const [items,setItems]=useState<StripeDispute[]|null>(null),[mode,setMode]=useState<'test'|'live'>('live'),[error,setError]=useState('')
 const load=useCallback(()=>{setItems(null);setError('');stripeConnectService.disputes().then(value=>{setItems(value.disputes);setMode(value.mode)}).catch(reason=>{setItems([]);setError(reason instanceof Error?reason.message:'Não foi possível carregar as contestações.')})},[])
 useEffect(()=>{load()},[load])
 const pending=(items||[]).filter(item=>open(item.status))
 return <section aria-label={uiText('Contestações')}>
  {error&&<div className="mb-3"><StateMessage title={uiText('Contestações indisponíveis')}><span>{error}</span> <button className="btn" onClick={load}><RotateCcw size={14}/><T> Tentar novamente</T></button></StateMessage></div>}
  {items===null?<Loading label="Carregando contestações"/>:<>
   <div className="report-kpis">{([['Contestações',String(items.length)],['Aguardando resposta',String(pending.length)],['Ganhas',String(items.filter(item=>item.status==='won').length)],['Perdidas',String(items.filter(item=>item.status==='lost').length)]] as const).map(([label,value])=><Card key={label} className="report-kpi"><span><T>{label}</T></span><strong>{value}</strong></Card>)}</div>
   <Card className="p-4 mb-4"><p className="text-sm flex gap-2"><ShieldAlert size={18} className="shrink-0"/><span><T>Contestação de cartão: envie as provas (comprovante de entrega, conversa com o cliente, termos aceitos) no painel da Stripe antes do prazo. Devolução Pix (MED): o banco decide e não é possível contestar. Responder a tempo é o que mais aumenta a chance de ganhar.</T></span></p>
    <a className="btn mt-3" href={mode==='live'?'https://dashboard.stripe.com/disputes':'https://dashboard.stripe.com/test/disputes'} target="_blank" rel="noreferrer"><ExternalLink size={15}/><T> Responder na Stripe</T></a></Card>
   <Card><div className="table-wrap"><table className="table"><caption className="sr-only"><T>Contestações</T></caption><thead><tr><th><T>Venda</T></th><th><T>Tipo</T></th><th><T>Motivo</T></th><th><T>Valor</T></th><th><T>Status</T></th><th><T>Prazo para responder</T></th></tr></thead>
    <tbody>{items.map(item=><tr key={item.id}><td><b>{item.productName||uiText('Venda fora da SphexPay')}</b><p className="muted text-[11px]">{item.customerName||''}{item.createdAt?` · ${shortDate(item.createdAt)}`:''}</p></td><td><T>{item.method==='pix'?'Pix (MED)':'Cartão'}</T></td><td><T>{REASON_LABEL[item.reason]||'Geral'}</T></td><td><b>{formatCents(item.amountCents,item.currency as 'BRL')}</b></td><td><span className="badge"><T>{DISPUTE_STATUS_LABEL[item.status]}</T></span></td><td>{open(item.status)&&item.method==='card'&&item.dueBy?<b>{shortDate(item.dueBy)}</b>:<span className="muted">-</span>}</td></tr>)}</tbody></table>
    {!items.length&&<Empty title={uiText('Nenhuma contestação')} text={uiText('Quando um comprador contestar uma compra no banco, ela aparece aqui com o prazo para responder.')}/>}</div></Card></>}
 </section>
}
