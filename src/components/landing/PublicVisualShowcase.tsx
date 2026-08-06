import { useEffect,useRef,useState,type KeyboardEvent } from 'react'
import { ArrowUpRight,ChevronLeft,ChevronRight,Globe2,Link2,Radio,Smartphone } from 'lucide-react'

type ShowcaseCard={id:string;tag:string;title:string;copy:string;kind:'checkout'|'global'|'dashboard'|'live'|'alerts'|'links'}

const cards:ShowcaseCard[]=[
 {id:'checkout',tag:'CHECKOUT',title:'Checkout sem fricção.',copy:'Uma jornada clara para cada decisão de compra.',kind:'checkout'},
 {id:'global',tag:'ALCANCE',title:'Operações sem fronteiras.',copy:'Contexto para acompanhar fluxos em movimento.',kind:'global'},
 {id:'dashboard',tag:'VISÃO',title:'Dashboard em contexto.',copy:'Indicadores que ajudam sua operação a decidir.',kind:'dashboard'},
 {id:'live',tag:'TEMPO REAL',title:'Vendas em movimento.',copy:'Eventos organizados enquanto acontecem.',kind:'live'},
 {id:'alerts',tag:'INTELIGÊNCIA',title:'Alertas no momento certo.',copy:'Notificações que preservam o ritmo da operação.',kind:'alerts'},
 {id:'links',tag:'CONVERSÃO',title:'Cobrança mais fluida.',copy:'Links e ofertas prontos para a próxima ação.',kind:'links'}
]

function CardVisual({kind}:{kind:ShowcaseCard['kind']}){
 if(kind==='checkout')return <div className="spx-visual-screen spx-visual-checkout"><div className="spx-screen-top"><i/><i/><i/><span>checkout.sphexpay</span></div><div className="spx-checkout-body"><div><small>RESUMO DO PEDIDO</small><strong>Produto digital</strong><span>Plano selecionado</span><b>R$ 297,00</b></div><aside><small>FORMA DE PAGAMENTO</small><div><i>PIX</i><i>CARD</i></div><label/><label/><button>Continuar com segurança <ArrowUpRight/></button></aside></div><em>PROCESSO DEMONSTRATIVO</em></div>
 if(kind==='global')return <div className="spx-visual-screen spx-visual-global"><div className="spx-global-orbit orbit-a"/><div className="spx-global-orbit orbit-b"/><div className="spx-global-globe"><Globe2/><i/><i/><i/><i/></div><span className="spx-global-chip chip-one">PIX · BR</span><span className="spx-global-chip chip-two">CARD · US</span><span className="spx-global-chip chip-three">LIVE · 24/7</span><small>FLUXOS CONECTADOS</small></div>
 if(kind==='dashboard')return <div className="spx-visual-screen spx-visual-dashboard"><div className="spx-dashboard-bar"><span>sphexpay</span><i/><i/></div><div className="spx-dashboard-content"><aside><small>VISÃO DA OPERAÇÃO</small><strong>Dashboard</strong><div/><div/><div/></aside><main><header><span>Resultado do período</span><b>R$ 21.418,20</b></header><div className="spx-dashboard-chart"><i/><i/><i/><i/><i/><i/><i/></div><div className="spx-dashboard-stats"><span><small>Vendas hoje</small><b>72</b></span><span><small>Aprovação</small><b>94,7%</b></span><span><small>Ticket médio</small><b>R$ 284</b></span></div></main></div></div>
 if(kind==='live')return <div className="spx-visual-screen spx-visual-live"><header><span><Radio/> VENDAS AO VIVO</span><small>agora</small></header><div className="spx-live-wave"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>{['Pix aprovado','Cartão confirmado','Link convertido'].map((item,index)=><article key={item}><i/><span><b>{item}</b><small>{index+1} min atrás · operação</small></span><strong>{index===0?'R$ 284,90':index===1?'R$ 179,00':'R$ 97,00'}</strong></article>)}</div>
 if(kind==='alerts')return <div className="spx-visual-screen spx-visual-alerts"><div className="spx-alerts-head"><BellGlyph/><span><small>NOTIFICAÇÕES</small><b>Eventos importantes</b></span><i>3</i></div>{['Nova venda recebida','Meta do período atualizada','Cliente retornou ao checkout'].map((item,index)=><article key={item}><i className={`alert-dot dot-${index}`}/><span><b>{item}</b><small>{index===0?'agora':'há '+(index+1)+' min'}</small></span><ArrowUpRight/></article>)}</div>
 return <div className="spx-visual-screen spx-visual-links"><div className="spx-links-phone"><Smartphone/><span>sphexpay.link</span><strong>Oferta especial</strong><small>Uma experiência direta para converter.</small><button>Ver oferta <ArrowUpRight/></button></div><div className="spx-links-badge"><Link2/><span><b>Link ativo</b><small>+18% conversão</small></span></div><div className="spx-links-orb"/>
 </div>
}

function BellGlyph(){return <span className="spx-bell-glyph" aria-hidden="true">•</span>}

function scrollShowcaseCard(viewport:HTMLDivElement|null,index:number,behavior:ScrollBehavior){
 const card=viewport?.querySelector<HTMLElement>(`[data-showcase-card="${cards[index].id}"]`)
 if(!viewport||!card)return
 const maxScroll=Math.max(0,viewport.scrollWidth-viewport.clientWidth)
 const target=Math.max(0,Math.min(maxScroll,card.offsetLeft-(viewport.clientWidth-card.offsetWidth)/2))
 viewport.scrollTo({left:target,behavior})
}

export function PublicVisualShowcase(){
 const viewport=useRef<HTMLDivElement>(null),[active,setActive]=useState(0),[paused,setPaused]=useState(false),[reduced,setReduced]=useState(()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches)
 const sync=()=>{const node=viewport.current;if(!node)return;const cardsIn=node.querySelectorAll<HTMLElement>('[data-showcase-card]');if(!cardsIn.length)return;const center=node.scrollLeft+node.clientWidth/2;let closest=0,delta=Infinity;cardsIn.forEach((card,index)=>{const cardCenter=card.offsetLeft+card.offsetWidth/2,distance=Math.abs(center-cardCenter);if(distance<delta){delta=distance;closest=index}});setActive(closest)}
 useEffect(()=>{if(typeof matchMedia!=='function')return;const media=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReduced(media.matches);media.addEventListener?.('change',update);return()=>media.removeEventListener?.('change',update)},[])
 useEffect(()=>{const node=viewport.current;if(!node||reduced||paused)return;const timer=window.setInterval(()=>{const next=(active+1)%cards.length;scrollShowcaseCard(node,next,'smooth')},6500);return()=>clearInterval(timer)},[active,paused,reduced])
 const select=(index:number)=>{const next=(index+cards.length)%cards.length;setActive(next);scrollShowcaseCard(viewport.current,next,reduced?'auto':'smooth')}
 const onKeyDown=(event:KeyboardEvent<HTMLDivElement>)=>{if(event.key==='ArrowRight'){event.preventDefault();select(active+1)}else if(event.key==='ArrowLeft'){event.preventDefault();select(active-1)}else if(event.key==='Home'){event.preventDefault();select(0)}else if(event.key==='End'){event.preventDefault();select(cards.length-1)}}
 return <section className="spx-visual-showcase" id="integracoes" aria-labelledby="spx-visual-title" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={()=>setPaused(false)}>
  <div className="spx-visual-heading"><span data-motion>EXPERIÊNCIA SPHEXPAY</span><h2 id="spx-visual-title"><span data-motion data-motion-delay="1">Veja sua operação</span><span className="spx-visual-accent" data-motion data-motion-delay="2">em movimento.</span></h2><i className="spx-visual-rule" data-motion data-motion-delay="3"/><p data-motion data-motion-delay="3">Uma leitura visual dos pontos que mantêm sua operação conectada, clara e pronta para o próximo passo.</p></div>
  <div className="spx-visual-viewport" ref={viewport} role="region" aria-label="Showcase visual da plataforma SphexPay" tabIndex={0} onScroll={sync} onKeyDown={onKeyDown}>
   <div className="spx-visual-track">{cards.map((card,index)=><article className={`spx-visual-card is-${card.kind}${active===index?' is-active':''}`} data-showcase-card={card.id} tabIndex={0} aria-label={`${card.tag}: ${card.title}`} key={card.id}><div className="spx-visual-media"><CardVisual kind={card.kind}/><div className="spx-visual-vignette"/></div><div className="spx-visual-card-copy"><span>{card.tag}</span><h3>{card.title}</h3><p>{card.copy}</p></div></article>)}</div>
  </div>
  <div className="spx-visual-controls"><button type="button" aria-label="Showcase anterior" onClick={()=>select(active-1)}><ChevronLeft/></button><div className="spx-visual-progress" aria-label={`Progresso: ${active+1} de ${cards.length}`}><span style={{width:`${((active+1)/cards.length)*100}%`}}/></div><button type="button" aria-label="Próximo showcase" onClick={()=>select(active+1)}><ChevronRight/></button></div>
  <div className="spx-visual-dots" role="tablist" aria-label="Selecionar showcase">{cards.map((card,index)=><button type="button" role="tab" aria-selected={active===index} aria-label={`Mostrar ${card.title}`} onClick={()=>select(index)} key={card.id}><span/></button>)}</div>
 </section>
}
