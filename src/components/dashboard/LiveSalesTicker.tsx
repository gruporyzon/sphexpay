import {translate as uiText} from '../../i18n'
import {useAppLocale} from '../../i18n/localeStore'
import {T} from '../../i18n'
import { Link } from 'react-router-dom'
import { Card } from '../ui'
import { maskBuyerName,type Currency,type ExchangeRate,type FinancialTransaction } from '../../lib/dashboardFinance'
import { ConvertedMoney } from './ConvertedMoney'
import { formatCents } from '../../lib/currencyFormat'
import { EmptyFinancialState } from './EmptyFinancialState'

const statusLabel:Record<FinancialTransaction['status'],string>={approved:'Aprovada',pending:'Pendente',declined:'Recusada',refunded:'Reembolsada',chargeback:'Chargeback'}
export function LiveSalesFeed({sales,displayCurrency,rates,limit=7}:{sales:FinancialTransaction[];displayCurrency:Currency;rates:ExchangeRate[];limit?:number}){useAppLocale(state=>state.locale);return <LiveSalesFeedContent sales={sales} displayCurrency={displayCurrency} rates={rates} limit={limit}/>}
export function LiveSalesFeedContent({sales,displayCurrency,rates,limit=7,planning=false}:{sales:FinancialTransaction[];displayCurrency:Currency;rates:ExchangeRate[];limit?:number;planning?:boolean}){useAppLocale(state=>state.locale);
 const demo=sales.some(item=>item.demo)
 const rows=sales.slice(0,limit).map((sale,index)=>{
  const content=<><div className="sale-method-mark">{sale.paymentMethod.slice(0,1)}</div><div className="sale-content"><div className="sale-primary"><p>{maskBuyerName(sale.buyerName)} · {sale.productName}</p><strong><ConvertedMoney amountCents={sale.amountCents} sourceCurrency={sale.currency} displayCurrency={displayCurrency} rates={rates} showOriginal/></strong></div><div className="sale-secondary"><span>{sale.paymentMethod}</span><span><T>Original </T>{formatCents(sale.amountCents,sale.currency)}</span></div><div className="sale-meta"><span className="badge">{planning?'Cenário':statusLabel[sale.status]}</span><span>{statusLabel[sale.status]} · {new Date(sale.occurredAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})} · {sale.transactionId.slice(-8)}</span></div></div></>
  return planning||sale.demo?<div key={sale.transactionId} className={`sale-row ${index===0?'sale-enter':''}`}>{content}</div>:<Link to={`/app/vendas/${encodeURIComponent(sale.transactionId)}`} key={sale.transactionId} className={`sale-row ${index===0?'sale-enter':''}`}>{content}</Link>
 })
 return <Card className="sales-card"><div className="sales-header"><div><span className="section-eyebrow"><i/> <T>{demo?'ATIVIDADE RECENTE':planning?'TIMELINE DE CENÁRIO':'FLUXO DE VENDAS'}</T></span><h2><T>{planning?'Resultados projetados':'Vendas recentes'}</T></h2><p><T>{demo?'Acompanhe as atualizações mais recentes':planning?'Registros restritos ao planejamento':'Transações persistidas no backend'}</T></p></div></div><div className="sales-list scrollbar">{rows.length?rows:<EmptyFinancialState/>}</div></Card>
}
export const LiveSalesTicker=LiveSalesFeed
export function LiveSalesSkeleton(){useAppLocale(state=>state.locale);return <Card className="sales-card"><div className="sales-skeleton" aria-label={uiText("Atualizando vendas")}>{Array.from({length:5},(_,index)=><i key={index}/>)}</div></Card>}
