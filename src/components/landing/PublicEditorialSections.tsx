import { BarChart3,Bell,Check,ChevronRight,CircleDollarSign,LayoutDashboard,LockKeyhole,Radio,ReceiptText,ShieldCheck,Users } from 'lucide-react'

const flow=[
 ['Cliente','Inicia a jornada',Users],
 ['Pagamento','Evento recebido',CircleDollarSign],
 ['Processamento','Status organizado',ReceiptText],
 ['Aprovação','Resultado confirmado',Check],
 ['Dashboard','Visão atualizada',LayoutDashboard],
 ['Notificação','Mensagem registrada',Bell]
] as const

export function PublicOperationalFlow(){
 return <section className="editorial-flow" id="fluxo" data-scroll-progress><header data-motion><span>FLUXO OPERACIONAL</span><h2>Cada venda movimenta toda a operação.</h2><p>Uma sequência visual que conecta os eventos disponíveis sem criar transações, alterar saldos ou simular processamento financeiro real.</p></header><div className="flow-track" aria-hidden="true"><i/></div><ol>{flow.map(([title,copy,Icon],index)=><li data-motion data-motion-delay={String(index)} key={title}><div><i><Icon/></i><small>0{index+1}</small></div><strong>{title}</strong><span>{copy}</span>{index<flow.length-1&&<ChevronRight aria-hidden="true"/>}</li>)}</ol></section>
}

export function PublicEditorialBenefits(){
 return <section className="editorial-benefits" id="recursos"><header data-motion><span>RECURSOS PRINCIPAIS</span><h2>Criado para sua operação avançar.</h2><p>Ferramentas conectadas, organizadas em uma experiência consistente e preparada para diferentes rotinas.</p></header><div className="feature-mosaic"><article className="wide feature-dashboard" data-motion><i><LayoutDashboard/></i><span>GESTÃO DE VENDAS</span><h3>Toda a operação em uma visão.</h3><p>Produtos, clientes, vendas e resultados organizados sem perder o contexto.</p><div className="benefit-visual-lines"><i/><i/><i/></div></article><article className="feature-live" data-motion><i><Radio/></i><span>TEMPO REAL</span><h3>Eventos em movimento.</h3><p>Acompanhe os registros disponíveis em um feed visual contínuo.</p><b><Radio/> Atualização organizada</b></article><article className="feature-security" data-motion><i><ShieldCheck/></i><span>SEGURANÇA</span><h3>Acesso protegido.</h3><p>Sessão validada e rotas privadas isoladas da experiência pública.</p></article><article className="feature-clients" data-motion><i><Users/></i><span>CLIENTES</span><h3>Relacionamentos em contexto.</h3><p>Consulte os dados disponíveis com organização e continuidade.</p></article><article className="feature-automation" data-motion><i><Bell/></i><span>AUTOMAÇÕES</span><h3>Mensagens no momento certo.</h3><p>Notificações e sequências configuráveis com fallback seguro.</p></article><article className="wide feature-reports" data-motion><i><BarChart3/></i><span>RELATÓRIOS E FINANCEIRO</span><h3>Indicadores que ajudam a decidir.</h3><p>Períodos, movimentações e leituras consolidadas em uma interface direta.</p><div className="mini-report"><i/><i/><i/><i/><i/></div></article></div></section>
}

export function PublicSecurityNote(){
 return <div className="editorial-security-note"><LockKeyhole/><span><b>Dados do mockup são ilustrativos.</b><small>A landing não consulta dados privados nem inicia processamento financeiro.</small></span></div>
}
