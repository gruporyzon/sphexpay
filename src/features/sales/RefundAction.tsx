import { useState } from 'react'
import { Undo2 } from 'lucide-react'
import { T,translate as uiText } from '../../i18n'
import { useAppLocale } from '../../i18n/localeStore'
import { StateMessage } from '../../components/ui'
import { formatCents } from '../../lib/currencyFormat'
import type { FinancialTransaction } from '../../lib/dashboardFinance'
import { stripeConnectService } from '../../services/stripeConnectService'

// Reembolso total pela Stripe. A venda só muda para "Reembolsada" quando o webhook confirma.
export function RefundAction({sale,onRequested}:{sale:FinancialTransaction;onRequested?:()=>void}){useAppLocale(state=>state.locale)
 const [confirming,setConfirming]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false)
 if(sale.demo||sale.status!=='approved'||!sale.transactionId.startsWith('stripe:'))return null
 const submit=async()=>{
  setBusy(true);setError('')
  try{await stripeConnectService.refund(sale.transactionId);setDone(true);setConfirming(false);onRequested?.()}
  catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível solicitar o reembolso.')}
  finally{setBusy(false)}
 }
 return <section className="sale-detail-section"><h3><T>Reembolso</T></h3>
  {done?<StateMessage tone="success" title={uiText('Reembolso solicitado')}><span><T>A Stripe está devolvendo o valor ao comprador. A venda muda para Reembolsada assim que a confirmação chegar.</T></span></StateMessage>:
  confirming?<div className="grid gap-3"><p className="text-sm"><T>Devolver </T><b>{formatCents(sale.amountCents,sale.currency)}</b><T> ao comprador? O valor sai do seu saldo na Stripe e as taxas de processamento não são devolvidas. Esta ação não pode ser desfeita.</T></p>
   <div className="flex gap-2 flex-wrap"><button className="btn" disabled={busy} onClick={()=>setConfirming(false)}><T>Cancelar</T></button><button className="btn btn-primary" disabled={busy} onClick={()=>void submit()}><Undo2 size={15}/><T>{busy?' Solicitando...':' Confirmar reembolso'}</T></button></div></div>:
  <button className="btn" onClick={()=>setConfirming(true)}><Undo2 size={15}/><T> Reembolsar venda</T></button>}
  {error&&<div className="mt-3"><StateMessage title={uiText('Reembolso não realizado')}><span>{error}</span></StateMessage></div>}
 </section>
}
