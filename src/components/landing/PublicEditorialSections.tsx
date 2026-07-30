import { useRef } from 'react'
import { ArrowLeft,ArrowRight,BarChart3,Bell,Check,ChevronRight,CircleDollarSign,LayoutDashboard,LockKeyhole,Package,Radio,ReceiptText,ShieldCheck,ShoppingCart,Trophy,Users,WalletCards } from 'lucide-react'

const flow=[
 ['Cliente','Inicia a jornada',Users],
 ['Pagamento','Evento recebido',CircleDollarSign],
 ['Processamento','Status organizado',ReceiptText],
 ['Aprovação','Resultado confirmado',Check],
 ['Dashboard','Visão atualizada',LayoutDashboard],
 ['Notificação','Mensagem registrada',Bell]
] as const

const resources=[
 ['Dashboard','Indicadores e períodos em uma visão central.',LayoutDashboard],
 ['Vendas ao Vivo','Mapa e feed visual de eventos disponíveis.',Radio],
 ['Transações','Histórico organizado por status e método.',ReceiptText],
 ['Produtos','Ofertas e itens conectados à operação.',Package],
 ['Checkout','Jornadas de cobrança preparadas no produto.',ShoppingCart],
 ['Financeiro','Leitura consolidada dos dados disponíveis.',WalletCards],
 ['Notificações','Personalização, dispositivos e sequências.',Bell],
 ['Premiações','Marcos oficiais e evolução da jornada.',Trophy]
] as const

export function PublicOperationalFlow(){
 return <section className="editorial-flow" id="fluxo"><header data-reveal><span>FLUXO OPERACIONAL</span><h2>Cada venda movimenta toda a operação.</h2><p>Uma sequência visual que conecta os eventos disponíveis sem criar transações, alterar saldos ou simular processamento financeiro real.</p></header><ol data-reveal>{flow.map(([title,copy,Icon],index)=><li key={title}><div><i><Icon/></i><small>0{index+1}</small></div><strong>{title}</strong><span>{copy}</span>{index<flow.length-1&&<ChevronRight aria-hidden="true"/>}</li>)}</ol></section>
}

export function PublicEditorialBenefits(){
 return <section className="editorial-benefits" id="recursos"><header data-reveal><span>ESTRUTURA PARA EVOLUIR</span><h2>Criado para sua operação avançar.</h2></header><div><article data-reveal><i><LayoutDashboard/></i><span>VISÃO UNIFICADA</span><h3>Operação centralizada.</h3><p>Produtos, clientes, vendas, notificações e resultados organizados na mesma experiência.</p></article><article className="dark" data-reveal><i><BarChart3/></i><span>LEITURA CONTÍNUA</span><h3>Resultados em contexto.</h3><p>Acompanhe períodos, eventos e indicadores disponíveis sem perder a origem da informação.</p><b><Radio/> Interface responsiva</b></article><article data-reveal><i><ShieldCheck/></i><span>ACESSO PROTEGIDO</span><h3>Segurança em cada etapa.</h3><p>Sessão validada, rotas privadas e credenciais sensíveis isoladas da interface pública.</p></article></div></section>
}

export function PublicResourceRail(){
 const rail=useRef<HTMLDivElement>(null)
 const move=(direction:number)=>rail.current?.scrollBy({left:direction*340,behavior:'smooth'})
 return <section className="resource-rail-section" aria-labelledby="resource-rail-title"><header data-reveal><div><span>RECURSOS CONECTADOS</span><h2 id="resource-rail-title">Uma plataforma, várias perspectivas.</h2><p>Explore os módulos que já fazem parte da experiência SphexPay.</p></div><div className="resource-rail-controls"><button onClick={()=>move(-1)} aria-label="Ver recursos anteriores"><ArrowLeft/></button><button onClick={()=>move(1)} aria-label="Ver próximos recursos"><ArrowRight/></button></div></header><div ref={rail} className="resource-rail" tabIndex={0} aria-label="Recursos da plataforma" onKeyDown={event=>{if(event.key==='ArrowRight'){event.preventDefault();move(1)}if(event.key==='ArrowLeft'){event.preventDefault();move(-1)}}}>{resources.map(([title,copy,Icon],index)=><article key={title} className={index%4===1?'dark':''}><header><i><Icon/></i><small>DISPONÍVEL</small></header><h3>{title}</h3><p>{copy}</p><span>Conhecer recurso <ArrowRight/></span></article>)}</div></section>
}

export function PublicSecurityNote(){
 return <div className="editorial-security-note"><LockKeyhole/><span><b>Dados do mockup são ilustrativos.</b><small>A landing não consulta dados privados nem inicia processamento financeiro.</small></span></div>
}
