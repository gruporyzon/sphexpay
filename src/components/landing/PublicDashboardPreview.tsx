import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis } from 'recharts'
import { ArrowLeftRight, BarChart3, Bell, Check, CircleDollarSign, GripHorizontal, House, LockKeyhole, RotateCcw, Settings2, ShoppingBag, Users, Wallet, Zap } from 'lucide-react'
import { SphexPayLogo } from '../branding/SphexPayLogo'

const series = [12, 26, 38, 29, 45, 64, 47, 53, 82, 73, 104, 61, 80, 122, 111, 126].map((value, index) => ({ day: `${String(index * 2 + 1).padStart(2, '0')} mai`, value, summary: Math.round(value * .82) }))
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function PublicDashboardPreview() {
 const [tab, setTab] = useState<'transactions' | 'summary'>('transactions')
 const [tick, setTick] = useState(0)
 const [position, setPosition] = useState({ x: 0, y: 0 })
 const stage = useRef<HTMLElement>(null)
 const drag = useRef<{ x: number; y: number; baseX: number; baseY: number } | null>(null)
 useEffect(() => {
  const media = matchMedia('(prefers-reduced-motion: reduce)')
  let visible = false
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
  if (stage.current) observer.observe(stage.current)
  const timer = window.setInterval(() => { if (visible && !document.hidden && !media.matches) setTick(value => value + 1) }, 4800)
  const reset = () => setPosition({ x: 0, y: 0 })
  window.addEventListener('resize', reset)
  return () => { observer.disconnect(); clearInterval(timer); window.removeEventListener('resize', reset) }
 }, [])
 const down = (event: PointerEvent<HTMLDivElement>) => {
  if (innerWidth <= 700 || (event.target as HTMLElement).closest('button')) return
  event.currentTarget.setPointerCapture(event.pointerId)
  drag.current = { x: event.clientX, y: event.clientY, baseX: position.x, baseY: position.y }
 }
 const move = (event: PointerEvent<HTMLDivElement>) => {
  if (!drag.current || !stage.current) return
  const limit = Math.max(0, (stage.current.clientWidth - 920) / 2)
  setPosition({ x: Math.max(-limit, Math.min(limit, drag.current.baseX + event.clientX - drag.current.x)), y: Math.max(-55, Math.min(55, drag.current.baseY + event.clientY - drag.current.y)) })
 }
 return <section ref={stage} className="ref-dashboard-stage" id="experiencia" aria-label="Prévia demonstrativa do dashboard SphexPay">
  <span className="ref-dashboard-hint"><GripHorizontal size={12} /> Arraste a barra de título para explorar</span>
  <div className="ref-dashboard-window" style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
   <div className="ref-dashboard-titlebar" onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}><span className="ref-window-dots" aria-hidden="true"><i /><i /><i /></span><span><LockKeyhole size={11} /> dashboard.sphexpay · demonstração</span><button type="button" onClick={() => setPosition({ x: 0, y: 0 })} aria-label="Centralizar prévia"><RotateCcw size={13} /></button></div>
   <div className="ref-dashboard-body"><aside className="ref-dashboard-sidebar" aria-hidden="true"><SphexPayLogo /><House /><ShoppingBag /><Users /><Settings2 /><Bell /></aside>
    <div className="ref-dashboard-main"><header><div><h2>Dashboard</h2><p>Uma visão completa da sua operação.</p></div><span>Este mês</span></header><div className="ref-dashboard-grid"><div className="ref-dashboard-overview"><article className="ref-balance"><small><Wallet size={13} /> Saldo demonstrativo</small><strong>{money.format(847293.55 + tick * 197)}</strong><span className="ref-auto"><Zap size={11} /> Auto · D3</span><div className="ref-goal"><span><Zap size={11} /> SUA META</span><small>85% concluído</small><progress value={85} max={100}>85%</progress></div><div className="ref-quick"><span><ArrowLeftRight />Transações</span><span><Wallet />Financeiro</span></div></article><article className="ref-kpis">{[[CircleDollarSign,'Receita bruta','R$ 8,49M'],[BarChart3,'Receita líquida','R$ 7,49M'],[ShoppingBag,'Pedidos','4.271']] .map(([Icon,label,value]) => { const Glyph = Icon as typeof Wallet; return <div key={String(label)}><Glyph /><span>{String(label)}</span><b>{String(value)}</b></div> })}</article></div>
     <article className="ref-dashboard-chart"><div className="ref-chart-tabs" role="group" aria-label="Visão do dashboard">{(['transactions','summary'] as const).map((value,index) => <button key={value} type="button" aria-pressed={tab===value} onClick={() => setTab(value)}>{index===0?'Transações':'Resumo'}</button>)}</div><div className="ref-chart-total"><small>ESTE MÊS</small><strong>{tab==='transactions'?'R$ 7.487.154,61':'R$ 6.139.466,78'}</strong></div><div className="ref-chart-canvas" aria-label="Evolução ilustrativa de vendas"><ResponsiveContainer width="100%" height="100%"><AreaChart data={series} margin={{top:35,right:6,left:0,bottom:0}}><defs><linearGradient id="reference-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8785fa" stopOpacity={.32}/><stop offset="100%" stopColor="#a9aff5" stopOpacity={.02}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#ededf2" strokeDasharray="3 6"/><XAxis dataKey="day" tick={{fontSize:9,fill:'#92929a'}} axisLine={false} tickLine={false} interval={2}/><Area type="monotone" dataKey={tab==='transactions'?'value':'summary'} stroke="#449bdd" strokeWidth={1.8} fill="url(#reference-chart-fill)" isAnimationActive={false}/></AreaChart></ResponsiveContainer></div><div className="ref-sale-toast" key={tick}><i><Check size={14}/></i><span><b>+ R$ 197,00</b><small>Exemplo de venda · Produto digital</small></span></div></article>
    </div></div>
   </div>
  </div>
 </section>
}
