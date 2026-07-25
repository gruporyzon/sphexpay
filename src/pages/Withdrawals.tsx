import { Check,Landmark,LoaderCircle,ShieldCheck,WalletCards,X } from 'lucide-react'
import { useEffect,useMemo,useRef,useState } from 'react'
import { Card,PageTitle } from '../components/ui'
import { withdrawalAmountToMinor,withdrawalMoney,withdrawalService,type LocalBankAccount,type LocalWithdrawal } from '../services/withdrawalService'
import { pushSubscriptionService } from '../services/pushSubscriptionService'
import { useAppStore } from '../store/useAppStore'
import type { Withdrawal } from '../types'

type Confirmation={amountInCents:number;lastDigits:string}
const toCache=(items:LocalWithdrawal[]):Withdrawal[]=>items.map(item=>({id:item.id,amount:item.amountInCents/100,fee:0,netAmount:item.amountInCents/100,currency:item.currency,date:item.createdAt,status:'Concluído',account:'Conta cadastrada',lastDigits:item.destinationLastDigits}))

const sendWithdrawalNotification=async(withdrawal:LocalWithdrawal)=>{
 if(!('Notification'in window)||Notification.permission!=='granted')return false
 const result=await pushSubscriptionService.send({eventId:`withdrawal-${withdrawal.id}`,type:'withdrawal_completed',title:'Saque realizado com sucesso',body:`Valor enviado: ${withdrawalMoney(withdrawal.amountInCents)}`,route:'/app/saques',createdAt:withdrawal.createdAt,currency:withdrawal.currency})
 return result.ok
}

export default function WithdrawalsPage(){
 const syncWithdrawalCache=useAppStore(state=>state.syncWithdrawalCache)
 const [amount,setAmount]=useState(''),[account,setAccount]=useState<LocalBankAccount|null>(null),[accountId,setAccountId]=useState(''),[availableInCents,setAvailableInCents]=useState(0),[withdrawals,setWithdrawals]=useState<LocalWithdrawal[]>([]),[processing,setProcessing]=useState(false),[error,setError]=useState(''),[confirmation,setConfirmation]=useState<Confirmation|null>(null),[notificationNotice,setNotificationNotice]=useState(''),[modal,setModal]=useState(false)
 const processingRef=useRef(false),confirmationTimer=useRef<number|undefined>(undefined)
 const amountInCents=withdrawalAmountToMinor(amount)

 useEffect(()=>{
  const data=withdrawalService.load()
  setAccount(data.account);setAccountId(data.account.id);setAvailableInCents(data.availableBalanceInCents);setWithdrawals(data.withdrawals)
  syncWithdrawalCache(data.availableBalanceInCents/100,toCache(data.withdrawals))
 },[syncWithdrawalCache])
 useEffect(()=>()=>window.clearTimeout(confirmationTimer.current),[])

 const validate=()=>{
  if(!amount.trim())return'Informe um valor de saque válido.'
  if(!Number.isFinite(amountInCents))return'Informe um valor de saque válido.'
  if(amountInCents<=0)return'Informe um valor maior que zero.'
  if(!accountId||!account||accountId!==account.id)return'Selecione uma conta de destino.'
  if(amountInCents>availableInCents)return'Saldo insuficiente para realizar este saque.'
  return''
 }
 const review=()=>{const issue=validate();if(issue){setError(issue);return}setError('');setConfirmation(null);setModal(true)}
 const confirm=async()=>{
  if(processingRef.current)return
  const issue=validate()
  if(issue){setError(issue);setModal(false);return}
  processingRef.current=true;setProcessing(true);setError('');setConfirmation(null);setNotificationNotice('')
  try{
   const result=withdrawalService.request(amountInCents,accountId)
   setAvailableInCents(result.availableBalanceInCents);setWithdrawals(result.withdrawals);syncWithdrawalCache(result.availableBalanceInCents/100,toCache(result.withdrawals))
   setAmount('');setModal(false);setConfirmation({amountInCents:result.withdrawal.amountInCents,lastDigits:result.withdrawal.destinationLastDigits})
   window.clearTimeout(confirmationTimer.current);confirmationTimer.current=window.setTimeout(()=>setConfirmation(null),5000)
   if(!('Notification'in window)||Notification.permission!=='granted')setNotificationNotice('Ative as notificações do dispositivo para receber confirmações.')
   else if(!await sendWithdrawalNotification(result.withdrawal))setNotificationNotice('Ative as notificações do dispositivo para receber confirmações.')
  }catch(requestError){setError((requestError as Error).message);setModal(false)}
  finally{processingRef.current=false;setProcessing(false)}
 }
 const history=useMemo(()=>[...withdrawals].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),[withdrawals])

 return <div className="page-enter withdrawals-secure"><PageTitle title="Saques" subtitle="Solicite saques e acompanhe o histórico de movimentações."/>
 <div className="withdrawal-layout"><Card className="withdrawal-request-card"><div className="withdrawal-balance-icon"><WalletCards/></div><span className="label">Saldo disponível</span><p>{withdrawalMoney(availableInCents)}</p>
 <label><span className="label">Valor do saque</span><input aria-label="Valor do saque" inputMode="decimal" className="input" value={amount} onChange={event=>{setAmount(event.target.value);setError('');setConfirmation(null)}} placeholder="R$ 0,00"/></label>
 <label><span className="label">Conta de destino</span><select aria-label="Conta de destino" className="input" value={accountId} onChange={event=>{setAccountId(event.target.value);setError('');setConfirmation(null)}}><option value="">Selecione uma conta</option>{account&&<option value={account.id}>{account.name} •••• {account.lastDigits}</option>}</select></label>
 <button className="btn btn-primary" disabled={processing} onClick={review}>{processing?<><LoaderCircle className="spin"/> Processando solicitação...</>:<>Confirmar solicitação</>}</button>
 {error&&<p className="withdrawal-error" role="alert">{error}</p>}
 {confirmation&&<div className="withdrawal-confirmation" role="status"><b>Saque solicitado com sucesso</b><span>Valor: {withdrawalMoney(confirmation.amountInCents)}</span><small>Conta final {confirmation.lastDigits}</small></div>}
 {notificationNotice&&<p className="withdrawal-notification-notice" role="status">{notificationNotice}</p>}</Card>
 <Card className="withdrawal-history-card"><header><div><b>Histórico de saques</b><span>Acompanhe suas solicitações e movimentações.</span></div></header>{history.length?<div className="withdrawal-history-list">{history.map(item=>{const createdAt=new Date(item.createdAt);return <article key={item.id}><div className="withdrawal-history-main"><span className="withdrawal-status-dot completed"/><div><b>{withdrawalMoney(item.amountInCents,item.currency)}</b><small>Conta final {item.destinationLastDigits}</small></div></div><dl><div><dt>Data</dt><dd>{createdAt.toLocaleDateString('pt-BR')}</dd></div><div><dt>Horário</dt><dd>{createdAt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</dd></div><div><dt>Status</dt><dd>Concluído</dd></div></dl></article>})}</div>:<div className="withdrawal-state"><Landmark/><p>Nenhum saque solicitado.</p></div>}</Card></div>
 {modal&&account&&<div className="withdrawal-modal-backdrop" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="withdrawal-confirm-title"><button className="withdrawal-modal-close" aria-label="Fechar confirmação" disabled={processing} onClick={()=>setModal(false)}><X/></button><div className="withdrawal-modal-icon"><ShieldCheck/></div><span>CONFIRMAÇÃO SEGURA</span><h2 id="withdrawal-confirm-title">Confirmar solicitação de saque</h2><dl><div><dt>Valor do saque</dt><dd>{withdrawalMoney(amountInCents)}</dd></div><div><dt>Taxa</dt><dd>{withdrawalMoney(0)}</dd></div><div><dt>Valor líquido</dt><dd>{withdrawalMoney(amountInCents)}</dd></div><div><dt>Conta de destino</dt><dd>{account.name} · final {account.lastDigits}</dd></div></dl><p>Revise os dados antes de concluir a solicitação.</p><footer><button className="btn" disabled={processing} onClick={()=>setModal(false)}>Cancelar</button><button className="btn btn-primary" disabled={processing} onClick={()=>void confirm()}>{processing?<><LoaderCircle className="spin"/> Processando solicitação...</>:<><Check/> Confirmar saque</>}</button></footer></section></div>}</div>
}
