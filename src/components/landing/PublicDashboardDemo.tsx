import { BarChart3,CheckCircle2,CreditCard,ShoppingBag,Wallet } from 'lucide-react'
import { type DashboardDemoEvent,useAnimatedDashboardValue,useDashboardDemo } from '../../hooks/useDashboardDemo'

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})
const integer=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0})
const chartPaths=[
 'M44 174 C82 160 103 170 136 141 S199 151 232 122 S292 134 327 91 S384 106 419 78 S481 89 520 51 S568 63 600 32',
 'M44 178 C81 164 105 169 139 144 S198 145 235 117 S293 130 329 87 S386 101 421 74 S480 84 523 48 S570 57 600 28',
 'M44 181 C82 165 107 173 141 139 S202 148 237 112 S296 126 333 83 S389 98 424 69 S484 80 526 43 S571 54 600 25',
 'M44 176 C82 161 106 166 143 136 S203 142 240 108 S299 121 335 79 S391 93 428 65 S486 75 529 40 S573 49 600 21',
 'M44 179 C84 158 108 164 145 133 S205 139 242 104 S301 117 338 76 S394 90 431 61 S489 72 532 37 S575 46 600 18',
]

function LiveMetric({label,target,status,kind='money',Icon,trend}:{label:string;target:number;status:string;kind?:'money'|'integer';Icon:typeof Wallet;trend:string}){
 const value=useAnimatedDashboardValue(target)
 return <article className="live-metric"><header><span><Icon/>{label}</span><small>{trend}</small></header><strong>{kind==='money'?money.format(value):integer.format(value)}</strong><footer><CheckCircle2/>{status}</footer><i aria-hidden="true"/></article>
}

function ProductChart({total,revision}:{total:number;revision:number}){
 const animatedTotal=useAnimatedDashboardValue(total),path=chartPaths[revision%chartPaths.length]??chartPaths[0]!,pointY=[32,28,25,21,18][revision%5]??32
 return <div className="public-product-chart is-live"><header><div><span>Resultado do período</span><strong>{money.format(animatedTotal)}</strong></div><small><i/> AO VIVO</small></header><svg viewBox="0 0 620 240" role="img" aria-label="Gráfico demonstrativo de resultado em atualização"><defs><linearGradient id="product-chart-fill-live" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f15a24" stopOpacity=".34"/><stop offset="1" stopColor="#f15a24" stopOpacity="0"/></linearGradient><filter id="product-chart-glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g className="grid"><path d="M44 24H600M44 82H600M44 140H600M44 198H600"/><path d="M44 24V198M180 24V198M320 24V198M460 24V198M600 24V198"/></g><path key={`area-${revision}`} className="area live-area" d={`${path} L600 198H44Z`}/><path key={`line-${revision}`} className="line live-line" filter="url(#product-chart-glow)" d={path}/><circle key={`point-${revision}`} className="live-point" cx="600" cy={pointY} r="5"/><g className="labels"><text x="44" y="224">início</text><text x="294" y="224">período</text><text x="558" y="224">agora</text></g></svg></div>
}

function LiveSales({events}:{events:DashboardDemoEvent[]}){
 return <div className="preview-sales live-sales"><header><span><i/> Vendas ao vivo</span><small>Atualizado agora</small></header><div className="live-sales-list" aria-live="polite">{events.map(event=><p key={event.id} className={`live-event ${event.status}`}><i/><span><b>{event.title}</b><small>{event.detail}</small></span><strong>{event.amount===undefined?'—':money.format(event.amount)}</strong></p>)}</div></div>
}

export function PublicDashboardDemo({className=''}:{className?:string}){
 const {metrics,events,revision}=useDashboardDemo()
 return <div className={`preview-overview live-overview ${className}`.trim()}><div className="preview-metrics"><LiveMetric label="Receita total" target={metrics.revenue} status="+8,6%" trend="vs. período anterior" Icon={Wallet}/><LiveMetric label="Receita líquida" target={metrics.net} status="+6,4%" trend="margem saudável" Icon={BarChart3}/><LiveMetric label="Pedidos" target={metrics.sales} status={`${metrics.approval.toLocaleString('pt-BR')}% aprovados`} kind="integer" trend="hoje" Icon={ShoppingBag}/><LiveMetric label="Ticket médio" target={284.9+revision*2.4} status="+4,2%" trend="por pedido" Icon={CreditCard}/></div><ProductChart total={metrics.revenue} revision={revision}/><LiveSales events={events}/></div>
}
