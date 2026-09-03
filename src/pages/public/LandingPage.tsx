import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight,BarChart3,Bell,Globe2,Layers3,LockKeyhole,Radio,Trophy,Zap } from 'lucide-react'
import { PublicHeader } from '../../components/landing/PublicHeader'
import { PublicOperationalExperience } from '../../components/landing/PublicOperationalExperience'
import { PublicInteractiveGlobe } from '../../components/landing/PublicInteractiveGlobe'
import { PublicCheckoutShowcase } from '../../components/landing/PublicCheckoutShowcase'
import { PublicFaq } from '../../components/landing/PublicFaq'
import { PublicVisualShowcase } from '../../components/landing/PublicVisualShowcase'
import { SphexPayLogo } from '../../components/branding/SphexPayLogo'
import { revenueAwards } from '../../config/revenueAwards'
import { useAuth } from '../../hooks/useAuth'
import { useLandingMotion } from '../../hooks/useLandingMotion'

const capabilityLabels=['Dashboard','Vendas ao vivo','Transações','Produtos','Clientes','Financeiro','Notificações','Premiações']

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
    <div className="landing-hero-copy"><h1 id="landing-title"><span data-motion data-motion-delay="1">Enquanto uns dormem,</span><span data-motion data-motion-delay="2">seu dinheiro atravessa o mundo.</span></h1><p data-motion data-motion-delay="3">Pagamentos globais e saque rápido.</p><div className="landing-hero-actions" data-motion data-motion-delay="4"><Link className="public-primary" to={accountDestination}>Comece a vender <ArrowRight/></Link><a href="#experiencia">Ver como funciona</a></div><dl className="hero-metrics" aria-label="Indicadores da plataforma">{[['6.99%','por transação'],['150+','países'],['3 dias','para saque']].map(([value,label],index)=><div data-motion data-motion-delay={String(index+5)} key={value}><dt>{value}</dt><dd>{label}</dd></div>)}</dl></div>
   </section>
   <section className="landing-trust" id="experiencia" data-motion aria-label="Áreas da plataforma"><span>UMA EXPERIÊNCIA CONECTADA À SUA OPERAÇÃO</span><div>{capabilityLabels.map(item=><b key={item}>{item}</b>)}</div></section>

   <section className="spx-global-showcase" id="vendas-ao-vivo" aria-labelledby="spx-global-title"><div className="spx-global-container"><div className="spx-global-copy"><span className="spx-global-label" data-motion>SPHEXPAY GLOBAL</span><h2 id="spx-global-title"><span data-motion data-motion-delay="1">Operação conectada</span><span data-motion data-motion-delay="2">com contexto e</span><span className="spx-global-accent" data-motion data-motion-delay="3">visão contínua.</span></h2><p data-motion data-motion-delay="4">Visualize fluxos, métodos e eventos da sua operação em uma experiência integrada, organizada para diferentes contextos.</p><div className="spx-global-metrics"><article data-motion data-motion-delay="5"><Globe2/><span><strong>Alcance</strong><small>Contexto operacional</small></span></article><article data-motion data-motion-delay="6"><Zap/><span><strong>Fluxos</strong><small>Leitura organizada</small></span></article><article data-motion data-motion-delay="7"><Layers3/><span><strong>Métodos</strong><small>Jornadas conectadas</small></span></article><article data-motion data-motion-delay="8"><Radio/><span><strong>Contínuo</strong><small>Acompanhamento visual</small></span></article></div></div><div className="spx-global-visual"><PublicInteractiveGlobe/></div></div></section>

   <PublicCheckoutShowcase/>
   <section className="rewards-section" id="premiacoes"><div data-motion><Trophy/><span>RECONHECIMENTO SPHEXPAY</span><h2>Resultados que merecem reconhecimento.</h2><p>A jornada de premiações apresenta os marcos oficiais configurados na plataforma, sem fabricar ganhadores ou resultados públicos.</p></div><div className="reward-track official-reward-track" data-motion>{revenueAwards.map(award=><article key={award.id}><img src={award.image} width="220" height="160" loading="lazy" alt={`Plaquinha ${award.name}`}/><strong>{award.name}</strong><span>Marco de reconhecimento</span></article>)}</div></section>
   <PublicVisualShowcase/>
    <PublicFaq/>
   <section className="spx-mobile-showcase" aria-labelledby="spx-mobile-title"><div className="spx-mobile-container"><div className="spx-mobile-copy"><span className="spx-mobile-label" data-motion>SPHEXPAY NO SEU DISPOSITIVO</span><h2 id="spx-mobile-title"><span data-motion data-motion-delay="1">Sua operação</span><span className="spx-mobile-accent" data-motion data-motion-delay="2">acompanha</span><span data-motion data-motion-delay="3">o seu ritmo.</span></h2><p data-motion data-motion-delay="4">Acompanhe vendas, movimentações e eventos importantes em uma experiência responsiva, disponível em diferentes telas.</p><div className="spx-mobile-benefits"><article data-motion data-motion-delay="5"><Bell/><span><b>Notificações em tempo real</b><small>Eventos importantes em contexto.</small></span></article><article data-motion data-motion-delay="6"><BarChart3/><span><b>Dashboard responsivo</b><small>Leitura adaptada a cada tela.</small></span></article><article data-motion data-motion-delay="7"><LockKeyhole/><span><b>Segurança em cada acesso</b><small>Experiência autenticada.</small></span></article><article data-motion data-motion-delay="8"><Layers3/><span><b>Vendas acompanhadas</b><small>Movimentações organizadas.</small></span></article></div><div className="spx-mobile-actions" data-motion data-motion-delay="8"><Link className="public-primary" to={accountDestination}>{user?'Abrir painel':'Conhecer a plataforma'} <ArrowRight/></Link><a href="#spx-mobile-preview">Ver experiência mobile</a></div></div><div className="spx-mobile-visual"><PublicOperationalExperience/></div></div></section>
  </main>
  <footer className="public-footer"><div><SphexPayLogo showName/><p>Plataforma financeira e inteligência operacional para negócios digitais.</p></div><div><span>Plataforma</span><a href="#experiencia">Produto</a><a href="#integracoes">Integrações</a></div><div><span>Conta</span><Link to="/entrar">Entrar</Link><Link to="/criar-conta">Criar conta</Link><Link to="/recuperar-senha">Recuperar senha</Link></div><div><span>Informações</span><Link to="/termos">Termos de Uso</Link><Link to="/privacidade">Política de Privacidade</Link><a href="#ajuda">Dúvidas</a></div><small>© {new Date().getFullYear()} SphexPay. Recursos transacionais dependem de integrações oficiais. Nenhum resultado público é simulado nesta página.</small></footer>
 </div>
}
