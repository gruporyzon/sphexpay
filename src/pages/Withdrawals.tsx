import {translate as uiText} from '../i18n'
import {useAppLocale} from '../i18n/localeStore'
import {T} from '../i18n'
import { Check,Landmark,LoaderCircle,ShieldCheck,WalletCards,X } from 'lucide-react'
import { useEffect,useMemo,useRef,useState } from 'react'
import { Card } from '../components/ui'
import { withdrawalAmountToMinor,withdrawalMoney,withdrawalService,type LocalBankAccount,type LocalWithdrawal } from '../services/withdrawalService'
import { useAppStore } from '../store/useAppStore'
import type { Withdrawal } from '../types'

type Confirmation={amountInCents:number;lastDigits:string}
const toCache=(items:LocalWithdrawal[]):Withdrawal[]=>items.map(item=>({id:item.id,amount:item.amountInCents/100,fee:0,netAmount:item.amountInCents/100,currency:item.currency,date:item.createdAt,status:'Concluído',account:'Conta cadastrada',lastDigits:item.destinationLastDigits}))

export default function WithdrawalsSection(){useAppLocale(state=>state.locale);
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
   setNotificationNotice('Nenhuma notificação financeira será gerada para este saque.')
  }catch(requestError){setError((requestError as Error).message);setModal(false)}
  finally{processingRef.current=false;setProcessing(false)}
 }
 const history=useMemo(()=>[...withdrawals].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),[withdrawals])

 return <section className="withdrawals-secure" aria-label={uiText("Saques")}><header className="financial-section-heading"><h2><T>Saques</T></h2><p><T>Solicite saques e acompanhe o histórico de movimentações.</T></p></header>
 <div className="withdrawal-layout"><Card className="withdrawal-request-card"><div className="withdrawal-balance-icon"><WalletCards/></div><span className="label"><T>Saldo disponível</T></span><p>{withdrawalMoney(availableInCents)}</p>
 <label><span className="label"><T>Valor do saque</T></span><input aria-label={uiText("Valor do saque")} inputMode="decimal" className="input" value={amount} onChange={event=>{setAmount(event.target.value);setError('');setConfirmation(null)}} placeholder={uiText("R$ 0,00")}/></label>
 <label><span className="label"><T>Conta de destino</T></span><select aria-label={uiText("Conta de destino")} className="input" value={accountId} onChange={event=>{setAccountId(event.target.value);setError('');setConfirmation(null)}}><option value=""><T>Selecione uma conta</T></option>{account&&<option value={account.id}>{account.name} •••• {account.lastDigits}</option>}</select></label>
 <button className="btn btn-primary" disabled={processing} onClick={review}>{processing?<><LoaderCircle className="spin"/><T> Processando solicitação...</T></>:<><T>Confirmar solicitação</T></>}</button>
 {error&&<p className="withdrawal-error" role="alert">{error}</p>}
 {confirmation&&<div className="withdrawal-confirmation" role="status"><b><T>Saque solicitado com sucesso</T></b><span><T>Valor: </T>{withdrawalMoney(confirmation.amountInCents)}</span><small><T>Conta final </T>{confirmation.lastDigits}</small></div>}
 {notificationNotice&&<p className="withdrawal-notification-notice" role="status">{notificationNotice}</p>}</Card>
 <Card className="withdrawal-history-card"><header><div><b><T>Histórico de saques</T></b><span><T>Acompanhe suas solicitações e movimentações.</T></span></div></header>{history.length?<div className="withdrawal-history-list">{history.map(item=>{const createdAt=new Date(item.createdAt);return <article key={item.id}><div className="withdrawal-history-main"><span className="withdrawal-status-dot completed"/><div><b>{withdrawalMoney(item.amountInCents,item.currency)}</b><small><T>Conta final </T>{item.destinationLastDigits}</small></div></div><dl><div><dt><T>Data</T></dt><dd>{createdAt.toLocaleDateString('pt-BR')}</dd></div><div><dt><T>Horário</T></dt><dd>{createdAt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</dd></div><div><dt><T>Status</T></dt><dd><T>Concluído</T></dd></div></dl></article>})}</div>:<div className="withdrawal-state"><Landmark/><p><T>Nenhum saque solicitado.</T></p></div>}</Card></div>
 {modal&&account&&<div className="withdrawal-modal-backdrop" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="withdrawal-confirm-title"><button className="withdrawal-modal-close" aria-label={uiText("Fechar confirmação")} disabled={processing} onClick={()=>setModal(false)}><X/></button><div className="withdrawal-modal-icon"><ShieldCheck/></div><span><T>CONFIRMAÇÃO SEGURA</T></span><h2 id="withdrawal-confirm-title"><T>Confirmar solicitação de saque</T></h2><dl><div><dt><T>Valor do saque</T></dt><dd>{withdrawalMoney(amountInCents)}</dd></div><div><dt><T>Taxa</T></dt><dd>{withdrawalMoney(0)}</dd></div><div><dt><T>Valor líquido</T></dt><dd>{withdrawalMoney(amountInCents)}</dd></div><div><dt><T>Conta de destino</T></dt><dd>{account.name}<T> · final </T>{account.lastDigits}</dd></div></dl><p><T>Revise os dados antes de concluir a solicitação.</T></p><footer><button className="btn" disabled={processing} onClick={()=>setModal(false)}><T>Cancelar</T></button><button className="btn btn-primary" disabled={processing} onClick={()=>void confirm()}>{processing?<><LoaderCircle className="spin"/><T> Processando solicitação...</T></>:<><Check/><T> Confirmar saque</T></>}</button></footer></section></div>}</section>
}
