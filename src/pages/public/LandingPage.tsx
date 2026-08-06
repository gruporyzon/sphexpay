import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight,BarChart3,Bell,Check,ChevronDown,CreditCard,Globe2,Layers3,Link2,LockKeyhole,Radio,RefreshCcw,Sparkles,Trophy,Zap } from 'lucide-react'
import { PublicHeader } from '../../components/landing/PublicHeader'
import { PublicPhoneExperience } from '../../components/landing/PublicPhoneExperience'
import { PublicInteractiveGlobe } from '../../components/landing/PublicInteractiveGlobe'
import { PublicCheckoutShowcase } from '../../components/landing/PublicCheckoutShowcase'
import { PublicDashboardDemo } from '../../components/landing/PublicDashboardDemo'
import { PublicCompetitionSection } from '../../components/landing/PublicCompetitionSection'
import { PublicFaq } from '../../components/landing/PublicFaq'
import { PublicEditorialBenefits,PublicOperationalFlow,PublicSecurityNote } from '../../components/landing/PublicEditorialSections'
import { SphexPayLogo } from '../../components/branding/SphexPayLogo'
import { revenueAwards } from '../../config/revenueAwards'
import { useAuth } from '../../hooks/useAuth'
import { useLandingMotion } from '../../hooks/useLandingMotion'

const capabilityLabels=['Dashboard','Vendas ao vivo','Transações','Produtos','Clientes','Financeiro','Notificações','Premiações']

function HeroDashboard(){return <div className="hero-product-stage" aria-label="Cenário ilustrativo do Dashboard SphexPay">
 <div className="hero-product-aura"/><div className="hero-browser">
  <header><i/><i/><i/><span>app.sphexpay</span><small>CENÁRIO ILUSTRATIVO</small></header>
  <div className="hero-browser-body"><aside><SphexPayLogo/>{[0,1,2,3,4].map(item=><i key={item}/>)}</aside><main>
   <div className="hero-dashboard-head"><span><small>VISÃO DA OPERAÇÃO</small><b>Dashboard</b></span><i/><i/></div>
   <PublicDashboardDemo className="hero-live-dashboard"/>
  </main></div>
 </div>
 </div>}

function CheckoutPreview(){return <div className="landing-checkout-preview" aria-label="Cenário ilustrativo do checkout SphexPay"><header><i/><i/><i/><span>checkout.sphexpay</span></header><main><section><small>RESUMO DO PEDIDO</small><h3>Seu pedido</h3><article><i><Layers3/></i><span><b>Produto digital</b><small>Acesso conforme a oferta</small></span><strong>Item selecionado</strong></article><article className="checkout-extra"><Check/><span><b>Complemento opcional</b><small>Adicione antes de continuar</small></span><i/></article><div className="checkout-total"><span>Total</span><b>Calculado no checkout</b></div></section><section><small>FORMA DE PAGAMENTO</small><div className="checkout-methods"><button className="active"><Zap/> Pix</button><button><CreditCard/> Cartão</button><button><Link2/> Boleto</button></div><label><span>Nome completo</span><i/></label><label><span>E-mail</span><i/></label><button className="checkout-submit">Continuar com segurança <ArrowRight/></button><p><LockKeyhole/> Processamento condicionado à integração oficial.</p></section></main></div>}

export default function LandingPage(){
 const {user}=useAuth(),accountDestination=user?(user.user_metadata?.onboarding_complete?'/app':'/onboarding'):'/criar-conta'
 useLandingMotion()
 useEffect(()=>{
  document.title='SphexPay — Sua operação no ritmo do próximo nível'
 },[])
 return <div className="landing landing-v2 landing-redesign" id="top">
  <a className="public-skip" href="#public-content">Ir para o conteúdo</a><PublicHeader/>
  <main id="public-content">
   <section className="landing-hero" aria-labelledby="landing-title" data-scroll-progress><div className="hero-grid"/>
    <div className="landing-hero-copy"><span className="hero-kicker" data-motion data-motion-delay="0">OPERAÇÃO SPHEXPAY</span><h1 id="landing-title"><span data-motion data-motion-delay="1">Pagamentos em movimento.</span><span data-motion data-motion-delay="2">Resultados sob controle.</span></h1><p data-motion data-motion-delay="3">Uma experiência centralizada para acompanhar pagamentos, vendas e toda a evolução da sua operação.</p><div className="landing-hero-actions" data-motion data-motion-delay="4"><Link className="public-primary" to={accountDestination}>{user?'Acessar meu painel':'Começar agora'} <ArrowRight/></Link><a href="#experiencia">Ver como funciona</a></div><dl className="hero-metrics" aria-label="Diferenciais da plataforma">{[['Tempo real','Visão da operação'],['Multimétodo','Jornadas conectadas'],['Responsivo','Acesso em cada tela']].map(([term,description],index)=><div data-motion data-motion-delay={String(index+5)} key={term}><dt>{term}</dt><dd>{description}</dd></div>)}</dl></div>
    <div className="landing-hero-visual" data-motion data-motion-kind="mockup"><HeroDashboard/></div><a className="hero-scroll" href="#experiencia"><span>Conheça a experiência</span><ChevronDown/></a>
   </section>
   <section className="landing-trust" id="experiencia" data-motion aria-label="Áreas da plataforma"><span>UMA EXPERIÊNCIA CONECTADA À SUA OPERAÇÃO</span><div>{capabilityLabels.map(item=><b key={item}>{item}</b>)}</div></section>

   <PublicEditorialBenefits/>
   <PublicOperationalFlow/>
   <section className="payment-section public-section--dark landing-checkout-section" id="solucoes"><div data-motion><span>VENDAS E CHECKOUT</span><h2 className="public-heading--on-dark">Uma jornada clara, do produto à confirmação.</h2><p className="public-copy--on-dark">Organize resumo, dados e formas de pagamento em uma experiência direta. O processamento real depende de integrações oficiais.</p><ul className="checkout-benefits"><li><Check/> Resumo transparente</li><li><Check/> Métodos organizados</li><li><Check/> Experiência responsiva</li></ul><div className="condition-card"><strong>Preparado para integrações oficiais</strong><p>A apresentação pública não cria cobranças nem processa pagamentos.</p><Link to={accountDestination}>{user?'Acessar painel':'Criar conta'} <ArrowRight/></Link></div></div><div data-motion><CheckoutPreview/><div className="payment-methods landing-method-strip">{[[Zap,'Pix'],[CreditCard,'Cartão'],[Layers3,'Boleto'],[RefreshCcw,'Assinaturas'],[Link2,'Links']].map(([Icon,label])=><article key={label as string}><i><Icon/></i><span><b>{label as string}</b><small>Integração oficial necessária</small></span><ArrowRight/></article>)}</div></div></section>

   <section className="spx-mobile-showcase" aria-labelledby="spx-mobile-title"><div className="spx-mobile-container"><div className="spx-mobile-copy"><span className="spx-mobile-label" data-motion>SPHEXPAY NO SEU DISPOSITIVO</span><h2 id="spx-mobile-title"><span data-motion data-motion-delay="1">Sua operação</span><span className="spx-mobile-accent" data-motion data-motion-delay="2">acompanha</span><span data-motion data-motion-delay="3">o seu ritmo.</span></h2><p data-motion data-motion-delay="4">Acompanhe vendas, movimentações e eventos importantes em uma experiência responsiva, disponível em diferentes telas.</p><div className="spx-mobile-benefits"><article data-motion data-motion-delay="5"><Bell/><span><b>Notificações em tempo real</b><small>Eventos importantes em contexto.</small></span></article><article data-motion data-motion-delay="6"><BarChart3/><span><b>Dashboard responsivo</b><small>Leitura adaptada a cada tela.</small></span></article><article data-motion data-motion-delay="7"><LockKeyhole/><span><b>Segurança em cada acesso</b><small>Experiência autenticada.</small></span></article><article data-motion data-motion-delay="8"><Layers3/><span><b>Vendas acompanhadas</b><small>Movimentações organizadas.</small></span></article></div><div className="spx-mobile-actions" data-motion data-motion-delay="8"><Link className="public-primary" to={accountDestination}>{user?'Abrir painel':'Conhecer a plataforma'} <ArrowRight/></Link><a href="#spx-mobile-preview">Ver experiência mobile</a></div></div><div className="spx-mobile-visual"><PublicPhoneExperience/></div></div></section>

   <section className="spx-global-showcase" id="vendas-ao-vivo" aria-labelledby="spx-global-title"><div className="spx-global-container"><div className="spx-global-copy"><span className="spx-global-label" data-motion>SPHEXPAY GLOBAL</span><h2 id="spx-global-title"><span data-motion data-motion-delay="1">Operação conectada</span><span data-motion data-motion-delay="2">com contexto e</span><span className="spx-global-accent" data-motion data-motion-delay="3">visão contínua.</span></h2><p data-motion data-motion-delay="4">Visualize fluxos, métodos e eventos da sua operação em uma experiência integrada, organizada para diferentes contextos.</p><div className="spx-global-metrics"><article data-motion data-motion-delay="5"><Globe2/><span><strong>Alcance</strong><small>Contexto operacional</small></span></article><article data-motion data-motion-delay="6"><Zap/><span><strong>Fluxos</strong><small>Leitura organizada</small></span></article><article data-motion data-motion-delay="7"><Layers3/><span><strong>Métodos</strong><small>Jornadas conectadas</small></span></article><article data-motion data-motion-delay="8"><Radio/><span><strong>Contínuo</strong><small>Acompanhamento visual</small></span></article></div></div><div className="spx-global-visual"><PublicInteractiveGlobe/></div></div></section>

   <PublicCheckoutShowcase/>
   <section className="rewards-section" id="premiacoes"><div data-motion><Trophy/><span>RECONHECIMENTO SPHEXPAY</span><h2>Resultados que merecem reconhecimento.</h2><p>A jornada de premiações apresenta os marcos oficiais configurados na plataforma, sem fabricar ganhadores ou resultados públicos.</p></div><div className="reward-track official-reward-track" data-motion>{revenueAwards.map(award=><article key={award.id}><img src={award.image} width="220" height="160" loading="lazy" alt={`Plaquinha ${award.name}`}/><strong>{award.name}</strong><span>Marco de reconhecimento</span></article>)}</div></section>
   <PublicCompetitionSection destination={accountDestination} authenticated={Boolean(user)}/>
   <section className="integration-section" id="integracoes"><header data-motion><span>ECOSSISTEMA SPHEXPAY</span><h2>Uma plataforma, vários pontos da operação.</h2><p>Sem logos ou parceiros fictícios: a experiência conecta apenas módulos confirmados no produto.</p></header><div data-motion>{['Produtos','Checkouts','Links de pagamento','Clientes','Notificações','Relatórios'].map(item=><span key={item}>{item}</span>)}</div></section>
   <PublicSecurityNote/><PublicFaq/>
   <section className="landing-cta public-section--dark" data-motion><Sparkles/><span>COMECE COM CLAREZA</span><h2 className="public-heading--on-dark">Seu próximo nível começa com uma operação melhor.</h2><p className="public-copy--on-dark">Centralize sua gestão, acompanhe seus resultados e construa uma operação preparada para crescer.</p><div><Link className="public-primary" to={accountDestination}>{user?'Acessar meu painel':'Criar minha conta'} <ArrowRight/></Link><Link to="/entrar">Entrar na plataforma</Link></div><small>Cadastre-se e acompanhe sua evolução na Competição SphexPay.</small></section>
  </main>
  <footer className="public-footer"><div><SphexPayLogo showName/><p>Plataforma financeira e inteligência operacional para negócios digitais.</p></div><div><span>Plataforma</span><a href="#experiencia">Produto</a><a href="#recursos">Recursos</a><a href="#integracoes">Integrações</a></div><div><span>Conta</span><Link to="/entrar">Entrar</Link><Link to="/criar-conta">Criar conta</Link><Link to="/recuperar-senha">Recuperar senha</Link><a href="#campeonato">Competição</a></div><div><span>Informações</span><Link to="/termos">Termos de Uso</Link><Link to="/privacidade">Política de Privacidade</Link><a href="#ajuda">Dúvidas</a></div><small>© {new Date().getFullYear()} SphexPay. Recursos transacionais dependem de integrações oficiais. Nenhum resultado público é simulado nesta página.</small></footer>
 </div>
}
