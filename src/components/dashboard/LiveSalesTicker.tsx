import { ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card,StatusBadge } from '../ui'
import { money,shortDate } from '../../lib/utils'
import type { Sale } from '../../types'
import { AnimatedMetric } from './AnimatedMetric'

export function LiveSalesTicker({sales,limit}:{sales:Sale[];limit:number}){
 return <Card className="sales-card">
  <div className="sales-header"><div><span className="section-eyebrow"><i/> FLUXO DE VENDAS</span><h2>Vendas recentes</h2><p>Dados confirmados por uma fonte autorizada</p></div></div>
  <div className="sales-list scrollbar">{sales.length?sales.slice(0,limit).map((sale,index)=><Link to={`/app/transacoes?evento=${encodeURIComponent(sale.id)}`} key={sale.id} className={`sale-row ${index===0?'sale-enter':''}`} aria-label={`Abrir transação ${sale.id}`}><div className="sale-method-mark" aria-hidden="true">{sale.method.slice(0,1)}</div><div className="sale-content"><div className="sale-primary"><p>{sale.product}</p><strong><AnimatedMetric value={sale.amount} format={value=>money(value,sale.currency)}/></strong></div><div className="sale-secondary"><span>{sale.method}</span><span>Comissão {money(sale.fee,sale.currency)}</span></div><div className="sale-meta"><StatusBadge status={sale.status}/><span>{shortDate(sale.date)} · {new Date(sale.date).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span></div></div></Link>):<div className="sales-empty"><ShoppingBag/><h3>Nenhuma venda registrada neste período.</h3><p>Os dados aparecerão quando uma fonte autorizada registrar transações reais.</p></div>}</div>
 </Card>
}

export function LiveSalesSkeleton(){return <Card className="sales-card"><div className="sales-header"><div><span className="section-eyebrow"><i/> FLUXO DE VENDAS</span><h2>Vendas em tempo real</h2><p>Sincronizando eventos</p></div></div><div className="sales-skeleton" aria-label="Atualizando vendas">{Array.from({length:5},(_,index)=><i key={index}/>)}</div></Card>}
