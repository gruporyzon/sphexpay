import { useEffect,useRef,useState,type KeyboardEvent } from 'react'
import { Check,CreditCard,Globe2,Package,Sparkles,Zap } from 'lucide-react'

const tabs=[
 {id:'bump',label:'Order Bump',title:'Mais valor. Zero fricção.',copy:'Adicione ofertas complementares no momento da decisão e aumente o ticket com uma experiência fluida.'},
 {id:'upsell',label:'Upsell One-Click',title:'Uma nova oferta. Um clique.',copy:'Apresente uma nova oportunidade logo após a compra e mantenha a jornada em continuidade sem complexidade.'},
 {id:'recurrence',label:'Recorrência',title:'Receita que continua.',copy:'Organize cobranças recorrentes, ciclos ativos e acompanhamento contínuo em uma operação previsível.'},
 {id:'global',label:'Checkout Global',title:'Checkout preparado para mais alcance.',copy:'Ofereça uma experiência consistente com diferentes métodos e uma visão operacional mais ampla.'}
] as const

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})
const liveEvents={
 bump:['Order bump aceito','Nova venda registrada','Item complementar adicionado'],
 upsell:['Upsell aprovado','Oferta aceita agora','Jornada continuada'],
 recurrence:['Recorrência renovada','Ciclo atualizado','Próxima cobrança organizada'],
 global:['Checkout aprovado','Método atualizado','Pagamento processado']
} as const

function useShowcaseSimulation(active:string){
 const [tick,setTick]=useState(0),[reduced,setReduced]=useState(()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches)
 useEffect(()=>{if(typeof matchMedia!=='function')return;const media=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(media.matches);media.addEventListener?.('change',update);return()=>media.removeEventListener?.('change',update)},[])
 useEffect(()=>{if(reduced)return;const timer=window.setInterval(()=>setTick(value=>value+1),3200);return()=>clearInterval(timer)},[active,reduced])
 const base=active==='bump'?224:active==='upsell'?297:active==='recurrence'?389:436
 return {tick,total:base+(tick%4)*13.9,event:liveEvents[active as keyof typeof liveEvents][tick%3]}
}

function CheckoutMockup({active,tick,total,event}:{active:string;tick:number;total:number;event:string}){
 const entries=active==='recurrence'?['Plano ativo','Renovação confirmada','Próximo ciclo']:active==='global'?['PIX · Brasil','Card · Checkout','Wire · Operação']:active==='upsell'?['Pedido confirmado','Oferta complementar','Aceite em um clique']:['Produto principal','Complemento sugerido','Benefício adicional']
 return <div className={`spx-commerce-mockup is-${active}`}>
  <div className="spx-commerce-aura"/><div className="spx-commerce-window"><header><i/><i/><i/><span>checkout.sphexpay</span><small>CENÁRIO ILUSTRATIVO</small></header>
   <main><div className="spx-commerce-summary"><span>{active==='recurrence'?'CICLOS E RENOVAÇÕES':active==='upsell'?'OFERTA APÓS A COMPRA':active==='global'?'MÉTODOS CONECTADOS':'RESUMO DO PEDIDO'}</span><h3>{active==='recurrence'?'Assinaturas':active==='upsell'?'Oferta especial':active==='global'?'Checkout':'Seu pedido'}</h3>
    <div className="spx-commerce-items">{entries.map((item,index)=><article className={index===1?'is-highlighted':''} key={item}><i>{index===0?<Package/>:index===1?<Sparkles/>:<Check/>}</i><span><b>{item}</b><small>{index===1&&active==='bump'?'Adicionado ao pedido':index===1&&active==='upsell'?'Aceito sem novo preenchimento':index===1&&active==='recurrence'?'Status renovado':'Evento acompanhado'}</small></span><strong>{index===0?money.format(total-27):index===1?`+ ${money.format(27)}`:'ATIVO'}</strong></article>)}</div>
    {active==='recurrence'&&<div className="spx-commerce-chart" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>}
    {active==='global'&&<div className="spx-commerce-methods"><span><Zap/> PIX</span><span><CreditCard/> CARD</span><span><Globe2/> WIRE</span></div>}
    <div className="spx-commerce-total"><span>Total demonstrativo</span><strong key={`${active}-${tick}`}>{money.format(total)}</strong></div><button type="button">{active==='upsell'?'Aceitar com um clique':active==='recurrence'?'Gerenciar ciclos':'Continuar com segurança'}</button>
   </div><aside><span>ATIVIDADE AO VIVO <i/></span><strong key={event}>{event}</strong><small>agora · simulação visual</small><div><b>{money.format(total)}</b><small>volume demonstrativo</small></div><ul>{liveEvents[active as keyof typeof liveEvents].map((item,index)=><li key={item}><i/><span>{item}</span><time>{index===0?'agora':`${index+1} min`}</time></li>)}</ul></aside></main>
  </div><div className="spx-commerce-toast" key={`${event}-${tick}`}><i><Check/></i><span><small>ATUALIZAÇÃO</small><b>{event}</b></span></div>
 </div>
}

export function PublicCheckoutShowcase(){
 const [active,setActive]=useState(0),tabRefs=useRef<Array<HTMLButtonElement|null>>([]),current=tabs[active],simulation=useShowcaseSimulation(current.id)
 const select=(index:number)=>{const next=(index+tabs.length)%tabs.length;setActive(next);tabRefs.current[next]?.focus()}
 const onKeyDown=(event:KeyboardEvent<HTMLDivElement>)=>{if(event.key==='ArrowRight'){event.preventDefault();select(active+1)}else if(event.key==='ArrowLeft'){event.preventDefault();select(active-1)}else if(event.key==='Home'){event.preventDefault();select(0)}else if(event.key==='End'){event.preventDefault();select(tabs.length-1)}}
 return <section className="spx-commerce-showcase" aria-labelledby="spx-commerce-title"><header><span data-motion>TUDO EM UM</span><h2 id="spx-commerce-title"><span data-motion data-motion-delay="1">Vendas</span> <em data-motion data-motion-delay="2">multiplicadas.</em></h2><p data-motion data-motion-delay="3">Cada recurso pensado para ampliar valor, conversão e continuidade operacional.</p></header>
  <div className="spx-commerce-tabs" role="tablist" aria-label="Recursos do checkout" onKeyDown={onKeyDown} data-motion data-motion-delay="4">{tabs.map((tab,index)=><button ref={node=>{tabRefs.current[index]=node}} type="button" role="tab" id={`commerce-tab-${tab.id}`} aria-controls={`commerce-panel-${tab.id}`} aria-selected={active===index} tabIndex={active===index?0:-1} onClick={()=>setActive(index)} key={tab.id}>{tab.label}</button>)}</div>
  <div className="spx-commerce-panel" role="tabpanel" id={`commerce-panel-${current.id}`} aria-labelledby={`commerce-tab-${current.id}`} tabIndex={0} data-motion data-motion-kind="mockup"><div className="spx-commerce-panel-content" key={current.id}><CheckoutMockup active={current.id} {...simulation}/><div className="spx-commerce-copy"><span>RECURSO SPHEXPAY</span><h3>{current.title}</h3><p>{current.copy}</p><ul><li><Check/> Simulação visual controlada</li><li><Check/> Experiência responsiva</li><li><Check/> Contexto operacional organizado</li></ul><small><i/> ATIVIDADE DEMONSTRATIVA</small></div></div></div>
 </section>
}
