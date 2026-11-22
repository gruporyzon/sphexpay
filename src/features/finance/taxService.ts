import {supabase} from '../../lib/supabase'
import type {FinancialTransaction} from '../../lib/dashboardFinance'
import {PRIMARY_CURRENCY} from './financeSummary'

// Reserva de imposto: só um cálculo exibido ao vendedor. Nada é retido nem enviado ao Fisco;
// o valor da venda continua indo inteiro para a conta Stripe do vendedor.
export type TaxRegime='mei'|'simples'|'presumido'|'real'
export type TaxSettings={regime:TaxRegime;reserveBps:number}
export type ItemKind='physical'|'digital'|'service'|'subscription'
export type FiscalProfile={itemKind:ItemKind;fiscalCode:string;notes:string}

export const TAX_REGIMES:{value:TaxRegime;label:string;hint:string}[]=[
 {value:'mei',label:'MEI',hint:'Imposto fixo mensal (DAS), igual em todo mês. Use a reserva só se quiser guardar o valor do DAS aos poucos.'},
 {value:'simples',label:'Simples Nacional',hint:'Porcentagem sobre o faturamento, conforme o anexo e a faixa da empresa.'},
 {value:'presumido',label:'Lucro Presumido',hint:'Vários tributos sobre o faturamento. Some as alíquotas indicadas pelo contador.'},
 {value:'real',label:'Lucro Real',hint:'Apuração sobre o lucro. Use a porcentagem média indicada pelo contador.'}
]
export const ITEM_KINDS:{value:ItemKind;label:string;code:string}[]=[
 {value:'physical',label:'Produto físico',code:'NCM'},
 {value:'digital',label:'Produto digital / infoproduto',code:'NBS'},
 {value:'service',label:'Serviço',code:'NBS'},
 {value:'subscription',label:'Assinatura / SaaS',code:'NBS'}
]
export const DEFAULT_TAX_SETTINGS:TaxSettings={regime:'mei',reserveBps:0}
export const DEFAULT_FISCAL_PROFILE:FiscalProfile={itemKind:'digital',fiscalCode:'',notes:''}

// "6,5" -> 650 pontos-base. Aceita vírgula ou ponto, de 0 a 100, até duas casas.
export function percentToBps(input:string):number|null{
 const text=input.trim().replace('%','').replace(',','.')
 if(!/^\d{1,3}(\.\d{1,2})?$/.test(text))return null
 const bps=Math.round(Number(text)*100)
 return bps>=0&&bps<=10000?bps:null
}
export const bpsToPercent=(bps:number)=>(bps/100).toLocaleString('pt-BR',{maximumFractionDigits:2})
export const reserveFor=(grossCents:number,bps:number)=>Math.round(Math.max(0,grossCents)*bps/10000)

export type TaxRow={id:string;date:string;productName:string;grossCents:number;feeCents:number;reserveCents:number;netCents:number}
export type TaxSummary={rows:TaxRow[];grossCents:number;feesCents:number;reserveCents:number;netAfterTaxCents:number;count:number}

// Base: valor bruto de cada venda aprovada em reais. Líquido = bruto - taxa SphexPay - reserva.
export function summarizeTaxReserve(transactions:FinancialTransaction[],bps:number,currency=PRIMARY_CURRENCY):TaxSummary{
 const rows=transactions.filter(row=>row.currency===currency&&row.status==='approved').map(row=>{
  const grossCents=row.grossAmountCents??row.amountCents,reserveCents=reserveFor(grossCents,bps)
  return{id:row.transactionId,date:row.occurredAt,productName:row.productName,grossCents,feeCents:row.feeCents,reserveCents,netCents:grossCents-row.feeCents-reserveCents}
 }).sort((a,b)=>b.date.localeCompare(a.date))
 const total=(pick:(row:TaxRow)=>number)=>rows.reduce((sum,row)=>sum+pick(row),0)
 return{rows,grossCents:total(row=>row.grossCents),feesCents:total(row=>row.feeCents),reserveCents:total(row=>row.reserveCents),netAfterTaxCents:total(row=>row.netCents),count:rows.length}
}

export const taxReportCsv=(summary:TaxSummary,settings:TaxSettings)=>{
 const regime=TAX_REGIMES.find(item=>item.value===settings.regime)?.label||settings.regime
 return summary.rows.map(row=>({data:new Date(row.date).toLocaleString('pt-BR'),produto:row.productName,valor_bruto:(row.grossCents/100).toFixed(2),taxa_sphexpay:(row.feeCents/100).toFixed(2),reserva_imposto:(row.reserveCents/100).toFixed(2),liquido_apos_imposto:(row.netCents/100).toFixed(2),regime,porcentagem_reserva:bpsToPercent(settings.reserveBps),referencia:row.id}))
}

const client=()=>{if(!supabase)throw new Error('SUPABASE_UNAVAILABLE');return supabase}
const isRegime=(value:unknown):value is TaxRegime=>TAX_REGIMES.some(item=>item.value===value)
const isKind=(value:unknown):value is ItemKind=>ITEM_KINDS.some(item=>item.value===value)

export const taxService={
 async getSettings(sellerId:string):Promise<TaxSettings>{
  const {data,error}=await client().from('seller_tax_settings').select('tax_regime,reserve_bps').eq('seller_id',sellerId).maybeSingle()
  if(error)throw error
  if(!data)return DEFAULT_TAX_SETTINGS
  return{regime:isRegime(data.tax_regime)?data.tax_regime:'mei',reserveBps:Number(data.reserve_bps)||0}
 },
 async saveSettings(sellerId:string,settings:TaxSettings){
  if(!isRegime(settings.regime)||!Number.isInteger(settings.reserveBps)||settings.reserveBps<0||settings.reserveBps>10000)throw new Error('INVALID_TAX_SETTINGS')
  const {error}=await client().from('seller_tax_settings').upsert({seller_id:sellerId,tax_regime:settings.regime,reserve_bps:settings.reserveBps},{onConflict:'seller_id'})
  if(error)throw error
 },
 async getFiscalProfile(productId:string):Promise<FiscalProfile|null>{
  const {data,error}=await client().from('product_fiscal_profiles').select('item_kind,fiscal_code,notes').eq('product_id',productId).maybeSingle()
  if(error)throw error
  if(!data)return null
  return{itemKind:isKind(data.item_kind)?data.item_kind:'digital',fiscalCode:String(data.fiscal_code||''),notes:String(data.notes||'')}
 },
 async saveFiscalProfile(sellerId:string,productId:string,profile:FiscalProfile){
  const code=profile.fiscalCode.trim()
  if(!isKind(profile.itemKind)||(code&&!/^[0-9.]{1,20}$/.test(code))||profile.notes.length>500)throw new Error('INVALID_FISCAL_PROFILE')
  const {error}=await client().from('product_fiscal_profiles').upsert({product_id:productId,seller_id:sellerId,item_kind:profile.itemKind,fiscal_code:code||null,notes:profile.notes.trim()||null},{onConflict:'product_id'})
  if(error)throw error
 }
}
