import type { Sale } from '../types'

export const WITHDRAWAL_BALANCE_KEY='sphexpay_available_balance'
export const WITHDRAWAL_ACCOUNT_KEY='sphexpay_withdrawal_account'
export const WITHDRAWALS_KEY='sphexpay_withdrawals'
export const INITIAL_BALANCE_IN_CENTS=16755569

export interface LocalBankAccount{
 id:string
 name:string
 bankName:string
 agency:string
 accountNumber:string
 lastDigits:string
 currency:Sale['currency']
}

export interface LocalWithdrawal{
 id:string
 amountInCents:number
 currency:Sale['currency']
 destinationLastDigits:string
 status:'completed'
 createdAt:string
}

export interface LocalWithdrawalData{
 account:LocalBankAccount
 availableBalanceInCents:number
 withdrawals:LocalWithdrawal[]
}

const defaultAccount:LocalBankAccount={
 id:'local-primary-account',
 name:'Conta cadastrada',
 bankName:'Conta principal',
 agency:'0001',
 accountNumber:'84821-0',
 lastDigits:'4821',
 currency:'BRL',
}

const storage=()=>typeof window==='undefined'?null:window.localStorage
const validCents=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>=0

const readBalance=()=>{
 const saved=storage()?.getItem(WITHDRAWAL_BALANCE_KEY)
 const value=saved===null||saved===undefined?NaN:Number(saved)
 if(validCents(value))return value
 storage()?.setItem(WITHDRAWAL_BALANCE_KEY,String(INITIAL_BALANCE_IN_CENTS))
 return INITIAL_BALANCE_IN_CENTS
}

const readAccount=()=>{
 try{
  const saved=JSON.parse(storage()?.getItem(WITHDRAWAL_ACCOUNT_KEY)||'null') as Partial<LocalBankAccount>|null
  if(saved?.id&&saved.lastDigits)return{...defaultAccount,...saved}
 }catch{ /* Recria somente este dado local quando estiver inválido. */ }
 storage()?.setItem(WITHDRAWAL_ACCOUNT_KEY,JSON.stringify(defaultAccount))
 return defaultAccount
}

const readWithdrawals=()=>{
 try{
  const saved=JSON.parse(storage()?.getItem(WITHDRAWALS_KEY)||'[]') as LocalWithdrawal[]
  if(Array.isArray(saved))return saved.filter(item=>item&&typeof item.id==='string'&&validCents(item.amountInCents)&&item.status==='completed')
 }catch{ /* Um histórico inválido começa vazio sem interromper a página. */ }
 storage()?.setItem(WITHDRAWALS_KEY,'[]')
 return[] as LocalWithdrawal[]
}

export const withdrawalService={
 load():LocalWithdrawalData{
  const account=readAccount(),availableBalanceInCents=readBalance(),withdrawals=readWithdrawals().sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
  storage()?.setItem(WITHDRAWAL_ACCOUNT_KEY,JSON.stringify(account))
  storage()?.setItem(WITHDRAWALS_KEY,JSON.stringify(withdrawals))
  return{account,availableBalanceInCents,withdrawals}
 },
 request(amountInCents:number,accountId:string){
  if(!Number.isSafeInteger(amountInCents)||amountInCents<=0)throw new Error('Informe um valor maior que zero.')
  const account=readAccount()
  if(!accountId||account.id!==accountId)throw new Error('Selecione uma conta de destino.')
  const availableBalanceInCents=readBalance()
  if(amountInCents>availableBalanceInCents)throw new Error('Saldo insuficiente para realizar este saque.')
  const withdrawal:LocalWithdrawal={
   id:crypto.randomUUID(),
   amountInCents,
   currency:'BRL',
   destinationLastDigits:account.lastDigits,
   status:'completed',
   createdAt:new Date().toISOString(),
  }
  const nextBalance=availableBalanceInCents-amountInCents
  const withdrawals=[withdrawal,...readWithdrawals().filter(item=>item.id!==withdrawal.id)]
  storage()?.setItem(WITHDRAWAL_BALANCE_KEY,String(nextBalance))
  storage()?.setItem(WITHDRAWALS_KEY,JSON.stringify(withdrawals))
  return{withdrawal,availableBalanceInCents:nextBalance,withdrawals}
 },
}

export const withdrawalAmountToMinor=(value:string)=>{
 const trimmed=value.trim()
 if(!trimmed)return NaN
 const normalized=trimmed.replace(/\s/g,'').replace(/[R$]/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.')
 if(!/^\d+(?:\.\d{0,2})?$/.test(normalized))return NaN
 const [whole,fraction='']=normalized.split('.')
 const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'))
 return Number.isSafeInteger(cents)?cents:NaN
}

export const withdrawalMoney=(minor:number,currency:Sale['currency']='BRL')=>{
 const locale=currency==='USD'?'en-US':'pt-BR'
 const formatted=new Intl.NumberFormat(locale,{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(minor/100)
 return currency==='USD'?formatted.replace('$','US$'):formatted
}
