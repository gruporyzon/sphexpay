import { Pause,Play,ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card,StatusBadge } from '../ui'
import { money,shortDate } from '../../lib/utils'
import type { Sale } from '../../types'
import { AnimatedMetric } from './AnimatedMetric'
import type { DashboardDataMode } from '../../services/dashboardDataSource'

export function LiveSalesTicker({sales,live,limit,mode,onToggle}:{sales:Sale[];live:boolean;limit:number;mode:DashboardDataMode;onToggle?:()=>void}){
 return <Card className="sales-card">
  <div className="sales-header"><div><span className="section-eyebrow"><i/> FLUXO DE VENDAS</span><h2>Vendas recentes</h2><p>{mode==='production'?'Aguardando uma fonte Realtime autorizada':live?'Simulação demonstrativa ativa':'Simulação demonstrativa pausada'}</p></div>{mode==='demo'&&<button className={`live-indicator ${!live?'paused':''}`} onClick={onToggle} title={live?'Pausar simulação':'Retomar simulação'}>{live?<Pause/>:<Play/>}<i/> {live?'Demo ao vivo':'Pausado'}</button>}</div>
  <div className="sales-list scrollbar">{sales.length?sales.slice(0,limit).map((sale,index)=><Link to={`/app/transacoes?evento=${encodeURIComponent(sale.id)}`} key={sale.id} className={`sale-row ${index===0?'sale-enter':''}`} aria-label={`Abrir transação ${sale.id}`}><div className="sale-method-mark" aria-hidden="true">{sale.method.slice(0,1)}</div><div className="sale-content"><div className="sale-primary"><p>{sale.product}</p><strong><AnimatedMetric value={sale.amount} format={value=>money(value,sale.currency)}/></strong></div><div className="sale-secondary"><span>{sale.method}</span><span>Comissão {money(sale.fee,sale.currency)}</span></div><div className="sale-meta"><StatusBadge status={sale.status}/><span>{shortDate(sale.date)} · {new Date(sale.date).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span></div></div></Link>):<div className="sales-empty"><ShoppingBag/><h3>{mode==='production'?'Nenhuma venda real disponível':'Nenhuma venda neste período'}</h3><p>{mode==='production'?'Conecte uma fonte server-side de transações para preencher este feed.':'Ajuste os filtros ou aguarde o próximo evento demonstrativo.'}</p></div>}</div>
 </Card>
}

export function LiveSalesSkeleton(){return <Card className="sales-card"><div className="sales-header"><div><span className="section-eyebrow"><i/> FLUXO DE VENDAS</span><h2>Vendas em tempo real</h2><p>Sincronizando eventos</p></div></div><div className="sales-skeleton" aria-label="Atualizando vendas">{Array.from({length:5},(_,index)=><i key={index}/>)}</div></Card>}
