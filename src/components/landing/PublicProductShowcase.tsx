import { type KeyboardEvent,useRef,useState } from 'react'
import { Award,Bell,CheckCircle2,CreditCard,Landmark,LayoutDashboard,Radio,ReceiptText,WalletCards } from 'lucide-react'
import { revenueAwards } from '../../config/revenueAwards'
import { PublicLiveSalesPreview } from './PublicLiveSalesPreview'

const views=[
 {id:'overview',label:'Visão geral',title:'Dashboard',icon:LayoutDashboard},
 {id:'payments',label:'Pagamentos',title:'Pagamentos',icon:CreditCard},
 {id:'live',label:'Vendas ao Vivo',title:'Vendas ao Vivo',icon:Radio},
 {id:'finance',label:'Financeiro',title:'Financeiro',icon:WalletCards},
 {id:'awards',label:'Premiações',title:'Premiações',icon:Award}
] as const
type ViewId=(typeof views)[number]['id']

function ProductChart(){
 return <div className="public-product-chart"><header><div><span>Resultado do período</span><strong>R$ 24.860,40</strong></div><small>30 dias</small></header><svg viewBox="0 0 620 240" role="img" aria-label="Gráfico ilustrativo de resultado em trinta dias"><defs><linearGradient id="product-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f15a24" stopOpacity=".3"/><stop offset="1" stopColor="#f15a24" stopOpacity="0"/></linearGradient></defs><g className="grid"><path d="M44 24H600M44 82H600M44 140H600M44 198H600"/><path d="M44 24V198M180 24V198M320 24V198M460 24V198M600 24V198"/></g><path className="area" d="M44 174 C82 160 103 170 136 141 S199 151 232 122 S292 134 327 91 S384 106 419 78 S481 89 520 51 S568 63 600 32 L600 198H44Z"/><path className="line" d="M44 174 C82 160 103 170 136 141 S199 151 232 122 S292 134 327 91 S384 106 419 78 S481 89 520 51 S568 63 600 32"/><circle cx="419" cy="78" r="5"/><g className="labels"><text x="44" y="224">01 jul</text><text x="294" y="224">15 jul</text><text x="558" y="224">30 jul</text></g></svg></div>
}
function Overview(){
 return <div className="preview-overview"><div className="preview-metrics">{[['Faturamento','R$ 24.860','+8,4%'],['Resultado líquido','R$ 21.418','+6,2%'],['Vendas aprovadas','72','94,7%']].map(([label,value,status])=><article key={label}><span>{label}</span><strong>{value}</strong><small><CheckCircle2/>{status}</small></article>)}</div><ProductChart/><div className="preview-sales"><header><span>Vendas recentes</span><small>Ver todas</small></header>{[['Pagamento aprovado','R$ 284,90','Pix'],['Pagamento aprovado','R$ 179,00','Cartão'],['Em processamento','R$ 96,50','Boleto']].map(([label,value,method],index)=><p key={value}><i className={index===2?'pending':''}/><span><b>{label}</b><small>{method}</small></span><strong>{value}</strong></p>)}</div></div>
}
function Payments(){
 return <div className="preview-payments"><div className="preview-summary"><article><CreditCard/><span>Pagamentos hoje</span><strong>32</strong><small>Todos os métodos</small></article><article><ReceiptText/><span>Confirmações</span><strong>29</strong><small>Status organizado</small></article></div><section><header><span>Transações recentes</span><small>Atualizado agora</small></header>{[['#SPX-4821','Pix','R$ 284,90','Aprovado'],['#SPX-4819','Cartão','R$ 179,00','Aprovado'],['#SPX-4816','Boleto','R$ 96,50','Processando'],['#SPX-4812','Pix','R$ 420,00','Aprovado']].map(row=><article key={row[0]}>{row.slice(0,3).map(item=><span key={item}>{item}</span>)}<strong className={row[3]==='Processando'?'pending':''}>{row[3]}</strong></article>)}</section></div>
}
function Finance(){
 return <div className="preview-finance"><div className="finance-balance"><Landmark/><span>Saldo disponível</span><strong>R$ 18.420,80</strong><small>Visão consolidada</small></div><div className="finance-breakdown">{[['Receitas','R$ 24.860,40','100%'],['Taxas','R$ 1.492,20','6%'],['Resultado líquido','R$ 21.418,20','86%']].map(([label,value,width])=><article key={label}><span>{label}<b>{value}</b></span><i><b style={{width}}/></i></article>)}</div><section><header><span>Movimentações</span><small>Julho</small></header>{[['Recebimento','Hoje, 12:42','+ R$ 284,90'],['Solicitação de saque','Ontem, 16:18','- R$ 1.200,00'],['Recebimento','Ontem, 11:06','+ R$ 420,00']].map(row=><p key={row[1]}><span><b>{row[0]}</b><small>{row[1]}</small></span><strong>{row[2]}</strong></p>)}</section></div>
}
function Awards(){
 const award=revenueAwards[1]??revenueAwards[0]
 return <div className="preview-awards"><div><span>Próximo marco</span><h3>Sphex 100K</h3><p>Sua jornada de reconhecimento em uma visão clara e progressiva.</p><div className="award-progress"><span><b>Progresso ilustrativo</b><strong>68%</strong></span><i><b/></i><small>Continue acompanhando a evolução da operação.</small></div></div>{award&&<figure><img src={award.image} width="300" height="220" loading="lazy" alt={`Plaquinha ${award.name}`}/><figcaption>Marco oficial SphexPay</figcaption></figure>}</div>
}

export function PublicProductShowcase(){
 const [selected,setSelected]=useState<ViewId>('overview'),refs=useRef<Array<HTMLButtonElement|null>>([])
 const view=views.find(item=>item.id===selected)??views[0]
 const selectByKeyboard=(event:KeyboardEvent<HTMLButtonElement>,index:number)=>{
  let target=index
  if(event.key==='ArrowRight')target=(index+1)%views.length
  else if(event.key==='ArrowLeft')target=(index-1+views.length)%views.length
  else if(event.key==='Home')target=0
  else if(event.key==='End')target=views.length-1
  else return
  event.preventDefault();setSelected(views[target].id);refs.current[target]?.focus()
 }
 return <section className="product-showcase" id="plataforma"><header data-reveal><span>CONHEÇA A PLATAFORMA</span><h2>Uma visão completa da sua operação, sem perder o contexto.</h2><p>Navegue pelas áreas que conectam pagamentos, vendas, financeiro e reconhecimento em uma experiência consistente.</p></header><div className="product-tabs" role="tablist" aria-label="Áreas da plataforma">{views.map((item,index)=><button ref={element=>{refs.current[index]=element}} role="tab" aria-selected={selected===item.id} aria-controls={`product-panel-${item.id}`} id={`product-tab-${item.id}`} tabIndex={selected===item.id?0:-1} key={item.id} onKeyDown={event=>selectByKeyboard(event,index)} onClick={()=>setSelected(item.id)}>{item.label}</button>)}</div><div className="product-preview" id={`product-panel-${view.id}`} role="tabpanel" aria-labelledby={`product-tab-${view.id}`} tabIndex={0} data-reveal><aside aria-label="Navegação ilustrativa"><b>SP</b>{views.map(item=>{const Icon=item.icon;return <i className={item.id===view.id?'active':''} key={item.id}><Icon/><span>{item.label}</span></i>})}</aside><main><header><div><small>SPHEXPAY</small><strong>{view.title}</strong></div><span><small>Cenário ilustrativo</small><Bell/></span></header><div className="product-canvas" key={view.id}>{selected==='overview'&&<Overview/>}{selected==='payments'&&<Payments/>}{selected==='live'&&<PublicLiveSalesPreview compact/>}{selected==='finance'&&<Finance/>}{selected==='awards'&&<Awards/>}</div></main></div></section>
}
