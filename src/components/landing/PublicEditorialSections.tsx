import { Globe2,RefreshCw,Users,Zap,Grid2X2 } from 'lucide-react'

const resourceCards=[
 {label:'CHECKOUT',title:'Absurdamente rápido.',copy:'Em 2 segundos, vendido.',tone:'checkout',Icon:Zap},
 {label:'BUILDER',title:'Crie. Publique. Venda.',copy:'Da configuração à oferta em poucos passos.',tone:'builder',Icon:Grid2X2},
 {label:'AFILIADOS',title:'Cada cliente, um vendedor.',copy:'Comissões automáticas. Crescimento orgânico.',tone:'clients',Icon:Users},
 {label:'PAGAMENTOS',title:'O mundo compra de você.',copy:'150 moedas. Um clique. Global.',tone:'payments',Icon:Globe2},
 {label:'AUTOMAÇÃO',title:'Vende enquanto você dorme.',copy:'Configure uma vez. Para sempre.',tone:'automation',Icon:RefreshCw}
] as const

function ResourceCard({card,index}:{card:typeof resourceCards[number];index:number}){
 const Icon=card.Icon
 return <article className={`feature-card feature-card-${card.tone} feature-card-position-${index}`} data-motion data-motion-delay={String(index+1)}>
  <div className="feature-card-visual" aria-hidden="true"><span><Icon/></span></div>
  <div className="feature-card-content"><span className="feature-card-label">{card.label}</span><h3>{card.title}</h3><p>{card.copy}</p></div>
 </article>
}

export function PublicEditorialBenefits(){
 return <section className="editorial-benefits" id="recursos"><header data-motion><span>RECURSOS PRINCIPAIS</span><h2>Criado para sua operação avançar.</h2><p>Ferramentas conectadas, organizadas em uma experiência consistente e preparada para diferentes rotinas.</p></header><div className="feature-mosaic">{resourceCards.map((card,index)=><ResourceCard card={card} index={index} key={card.label}/>)}</div></section>
}
