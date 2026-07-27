import { Link } from 'react-router-dom'
import { Card } from '../ui'
import { maskBuyerName,type Currency,type ExchangeRate,type FinancialTransaction } from '../../lib/dashboardFinance'
import { ConvertedMoney } from './ConvertedMoney'
import { formatCents } from '../../lib/currencyFormat'
import { EmptyFinancialState } from './EmptyFinancialState'

const statusLabel:Record<FinancialTransaction['status'],string>={approved:'Aprovada',pending:'Pendente',declined:'Recusada',refunded:'Reembolsada',chargeback:'Chargeback'}
export function LiveSalesFeed({sales,displayCurrency,rates,limit=7}:{sales:FinancialTransaction[];displayCurrency:Currency;rates:ExchangeRate[];limit?:number}){return <LiveSalesFeedContent sales={sales} displayCurrency={displayCurrency} rates={rates} limit={limit}/>}
export function LiveSalesFeedContent({sales,displayCurrency,rates,limit=7,planning=false}:{sales:FinancialTransaction[];displayCurrency:Currency;rates:ExchangeRate[];limit?:number;planning?:boolean}){
 const demo=sales.some(item=>item.demo)
 const rows=sales.slice(0,limit).map((sale,index)=>{
  const content=<><div className="sale-method-mark">{sale.paymentMethod.slice(0,1)}</div><div className="sale-content"><div className="sale-primary"><p>{maskBuyerName(sale.buyerName)} · {sale.productName}</p><strong><ConvertedMoney amountCents={sale.amountCents} sourceCurrency={sale.currency} displayCurrency={displayCurrency} rates={rates} showOriginal/></strong></div><div className="sale-secondary"><span>{sale.paymentMethod}</span><span>Original {formatCents(sale.amountCents,sale.currency)}</span></div><div className="sale-meta"><span className="badge">{sale.demo?'Demonstração':planning?'Cenário':statusLabel[sale.status]}</span><span>{statusLabel[sale.status]} · {new Date(sale.occurredAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})} · {sale.transactionId.slice(-8)}</span></div></div></>
  return planning||sale.demo?<div key={sale.transactionId} className={`sale-row ${index===0?'sale-enter':''}`}>{content}</div>:<Link to={`/app/transacoes?evento=${encodeURIComponent(sale.transactionId)}`} key={sale.transactionId} className={`sale-row ${index===0?'sale-enter':''}`}>{content}</Link>
 })
 return <Card className="sales-card"><div className="sales-header"><div><span className="section-eyebrow"><i/> {demo?'ATIVIDADE DEMONSTRATIVA':planning?'TIMELINE DE CENÁRIO':'FLUXO DE VENDAS'}</span><h2>{planning?'Resultados projetados':'Vendas recentes'}</h2><p>{demo?'Transações sintéticas locais, sem pagamentos reais':planning?'Registros sintéticos restritos ao planejamento':'Transações persistidas no backend'}</p></div></div><div className="sales-list scrollbar">{rows.length?rows:<EmptyFinancialState/>}</div></Card>
}
export const LiveSalesTicker=LiveSalesFeed
export function LiveSalesSkeleton(){return <Card className="sales-card"><div className="sales-skeleton" aria-label="Atualizando vendas">{Array.from({length:5},(_,index)=><i key={index}/>)}</div></Card>}
