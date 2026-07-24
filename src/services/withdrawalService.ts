import { supabase } from '../lib/supabase'
import type { Sale } from '../types'

export type WithdrawalStatus='requested'|'processing'|'completed'|'rejected'|'cancelled'|'failed'
export interface BankAccount{id:string;label:string;bankName:string;lastDigits:string;currency:Sale['currency']}
export interface SecureWithdrawal{id:string;bankAccountId:string;grossAmountMinor:number;feeAmountMinor:number;netAmountMinor:number;currency:Sale['currency'];status:WithdrawalStatus;destinationLabel:string;destinationLastDigits:string;idempotencyKey:string;requestedAt:string;processedAt:string|null;completedAt:string|null;failureReason:string|null}
export interface WalletBalance{currency:Sale['currency'];availableBalanceMinor:number}
export interface WithdrawalRequestResult{withdrawal:SecureWithdrawal;availableBalanceMinor:number;duplicate:boolean}

const mapWithdrawal=(row:Record<string,unknown>):SecureWithdrawal=>({
 id:String(row.id),bankAccountId:String(row.bank_account_id),grossAmountMinor:Number(row.gross_amount_minor),feeAmountMinor:Number(row.fee_amount_minor),netAmountMinor:Number(row.net_amount_minor),currency:row.currency as Sale['currency'],status:row.status as WithdrawalStatus,destinationLabel:String(row.destination_label),destinationLastDigits:String(row.destination_last_digits),idempotencyKey:String(row.idempotency_key),requestedAt:String(row.requested_at),processedAt:row.processed_at?String(row.processed_at):null,completedAt:row.completed_at?String(row.completed_at):null,failureReason:row.failure_reason?String(row.failure_reason):null
})
const errorMessage=(error:unknown)=>{
 const message=String((error as {message?:string})?.message||error)
 if(message.includes('INSUFFICIENT_BALANCE'))return'Saldo insuficiente para realizar este saque.'
 if(message.includes('INVALID_AMOUNT'))return'Informe um valor de saque válido.'
 if(message.includes('BANK_ACCOUNT_REQUIRED'))return'Selecione uma conta de destino.'
 if(message.includes('BANK_ACCOUNT_UNAVAILABLE'))return'A conta selecionada não está disponível.'
 if(message.includes('AUTH_REQUIRED'))return'Entre novamente para solicitar o saque.'
 if(message.includes('IDEMPOTENCY'))return'Esta solicitação já está sendo processada.'
 if(message.includes('WALLET_UNAVAILABLE'))return'Não foi possível localizar uma carteira ativa para esta moeda.'
 return'Não foi possível solicitar o saque. Tente novamente.'
}
export const withdrawalService={
 available(){return Boolean(supabase)},
 async load(){
  if(!supabase)throw new Error('O serviço seguro de saques não está configurado.')
  const [{data:wallets,error:walletError},{data:accounts,error:accountError},{data:withdrawals,error:withdrawalError}]=await Promise.all([
   supabase.from('wallets').select('currency,available_balance_minor'),
   supabase.from('bank_accounts').select('id,label,bank_name,account_last_digits,currency').eq('active',true).order('created_at'),
   supabase.from('withdrawals').select('*').order('requested_at',{ascending:false})
  ])
  if(walletError||accountError||withdrawalError)throw new Error('Não foi possível carregar os dados de saque.')
  return{
   wallets:(wallets||[]).map(row=>({currency:row.currency as Sale['currency'],availableBalanceMinor:Number(row.available_balance_minor)})),
   accounts:(accounts||[]).map(row=>({id:String(row.id),label:String(row.label),bankName:String(row.bank_name),lastDigits:String(row.account_last_digits),currency:row.currency as Sale['currency']})),
   withdrawals:(withdrawals||[]).map(row=>mapWithdrawal(row as Record<string,unknown>))
  }
 },
 async request(amountMinor:number,bankAccountId:string,idempotencyKey:string):Promise<WithdrawalRequestResult>{
  if(!supabase)throw new Error('O serviço seguro de saques não está configurado.')
  try{
   const {data,error}=await supabase.rpc('request_withdrawal',{p_amount_minor:amountMinor,p_bank_account_id:bankAccountId,p_idempotency_key:idempotencyKey})
   if(error)throw error
   const result=data as unknown as {duplicate:boolean;withdrawal:Record<string,unknown>;available_balance_minor?:number}
   if(!result?.withdrawal)throw new Error('INVALID_RESPONSE')
   const withdrawal=mapWithdrawal(result.withdrawal)
   return{withdrawal,availableBalanceMinor:Number(result.available_balance_minor??0),duplicate:Boolean(result.duplicate)}
  }catch(error){throw new Error(errorMessage(error))}
 },
 subscribe(userId:string,onChange:(withdrawal:SecureWithdrawal)=>void){
  if(!supabase)return()=>undefined
  const client=supabase,channel=client.channel(`withdrawals:${userId}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'withdrawals',filter:`user_id=eq.${userId}`},payload=>onChange(mapWithdrawal(payload.new as Record<string,unknown>))).subscribe()
  return()=>{void client.removeChannel(channel)}
 }
}
export const withdrawalAmountToMinor=(value:string)=>{
 const normalized=value.trim().replace(/\s/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.'),amount=Number(normalized)
 return Number.isFinite(amount)?Math.round(amount*100):NaN
}
export const withdrawalMoney=(minor:number,currency:Sale['currency'])=>{
 const locale=currency==='USD'?'en-US':'pt-BR',formatted=new Intl.NumberFormat(locale,{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(minor/100)
 return currency==='USD'?formatted.replace('$','US$'):formatted
}
