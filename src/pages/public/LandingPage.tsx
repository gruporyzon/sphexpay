import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight,Bell,Check,ChevronDown,CreditCard,Globe2,Layers3,Link2,LockKeyhole,RefreshCcw,ShieldCheck,Sparkles,Trophy,Zap } from 'lucide-react'
import { PublicHeader } from '../../components/landing/PublicHeader'
import { PublicPhoneExperience } from '../../components/landing/PublicPhoneExperience'
import { PublicProductShowcase } from '../../components/landing/PublicProductShowcase'
import { PublicCompetitionSection } from '../../components/landing/PublicCompetitionSection'
import { PublicFaq } from '../../components/landing/PublicFaq'
import { PublicLiveSalesPreview } from '../../components/landing/PublicLiveSalesPreview'
import { PublicEditorialBenefits,PublicOperationalFlow,PublicResourceRail,PublicSecurityNote } from '../../components/landing/PublicEditorialSections'
import { SphexPayLogo } from '../../components/branding/SphexPayLogo'
import { revenueAwards } from '../../config/revenueAwards'
import { useAuth } from '../../hooks/useAuth'

const capabilityLabels=['Dashboard','Vendas ao vivo','Transações','Produtos','Clientes','Financeiro','Notificações','Premiações']

export default function LandingPage(){
 const {user}=useAuth(),accountDestination=user?(user.user_metadata?.onboarding_complete?'/app':'/onboarding'):'/criar-conta'
 useEffect(()=>{
  document.title='SphexPay — Sua operação no ritmo do próximo nível'
  const elements=document.querySelectorAll<HTMLElement>('[data-reveal]'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches
  if(reduced){elements.forEach(element=>element.classList.add('revealed'));return}
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('revealed');observer.unobserve(entry.target)}}),{threshold:.12,rootMargin:'0px 0px -35px'})
  elements.forEach(element=>observer.observe(element));return()=>observer.disconnect()
 },[])
 return <div className="landing landing-v2" id="top">
  <a className="public-skip" href="#public-content">Ir para o conteúdo</a>
  <PublicHeader/>
  <main id="public-content">
   <aside className="competition-ribbon" aria-label="Destaque da competição"><Trophy/><span><b>Competição SphexPay</b> — Concorra a um iPhone 17 Pro Max</span><a href="#campeonato">Conhecer campeonato <ArrowRight/></a></aside>
   <section className="landing-hero" aria-labelledby="landing-title"><div className="hero-grid"/><div className="hero-orb orb-one"/><div className="hero-orb orb-two"/>
    <div className="landing-hero-copy"><span className="landing-kicker"><i/> Plataforma financeira para negócios digitais</span><h1 id="landing-title">Pagamentos em movimento. <em>Resultados sob controle.</em></h1><p>Acompanhe pagamentos, vendas, clientes e resultados em uma operação centralizada e preparada para crescer.</p><div className="landing-hero-actions"><Link className="public-primary" to={accountDestination}>{user?'Acessar meu painel':'Criar minha conta'} <ArrowRight/></Link><a href="#plataforma"><span>Conhecer a plataforma</span><ArrowRight/></a></div><ul className="hero-assurances" aria-label="Diferenciais de acesso"><li><Check/> Ativação orientada</li><li><Check/> Segurança operacional</li><li><Check/> Visão em tempo real</li></ul>
    </div><div className="landing-hero-visual"><PublicPhoneExperience/></div><a className="hero-scroll" href="#plataforma"><span>Explore a plataforma</span><ChevronDown/></a>
   </section>
   <section className="landing-trust" data-reveal aria-label="Áreas da plataforma"><span>UMA EXPERIÊNCIA CONECTADA À SUA OPERAÇÃO</span><div>{capabilityLabels.map(item=><b key={item}>{item}</b>)}</div></section>
   <PublicOperationalFlow/>
   <PublicEditorialBenefits/>
   <PublicResourceRail/>
   <PublicProductShowcase/>
   <section className="payment-section" id="solucoes"><div data-reveal><span>JORNADAS DE COBRANÇA</span><h2>Meios de pagamento organizados com transparência.</h2><p>A interface contempla Pix, cartão, boleto, assinaturas e links. O processamento real e a disponibilidade de cada modalidade dependem de integrações oficiais ainda não conectadas neste ambiente.</p><div className="condition-card"><strong>Condições ajustadas à sua operação</strong><p>Conheça as condições disponíveis para o perfil e o volume do seu negócio quando os provedores oficiais estiverem integrados.</p><Link to={accountDestination}>{user?'Acessar painel':'Criar conta'} <ArrowRight/></Link></div></div><div className="payment-methods" data-reveal>{[[Zap,'Pix'],[CreditCard,'Cartão'],[Layers3,'Boleto'],[RefreshCcw,'Assinaturas'],[Link2,'Links']].map(([Icon,label])=><article key={label as string}><Icon/><span><b>{label as string}</b><small>Disponibilidade vinculada à integração oficial</small></span></article>)}</div></section>
   <section className="live-public-section" id="vendas-ao-vivo"><div className="live-public-copy" data-reveal><span>VENDAS EM TEMPO REAL</span><h2>Veja sua operação ganhar alcance em cada nova venda.</h2><p>Acompanhe eventos, regiões e resultados em uma experiência visual integrada ao seu gateway.</p><Link to={accountDestination} className="public-text-link">Abrir Vendas ao Vivo <ArrowRight/></Link><div className="live-public-highlights"><span><b>Mapa conectado</b><small>Atividade por região</small></span><span><b>Feed organizado</b><small>Método, valor e horário</small></span></div></div><div data-reveal><PublicLiveSalesPreview/></div></section>
   <section className="smart-notifications-section" id="notificacoes"><div className="smart-notifications-visual" data-reveal><div className="notification-orbit"/><article><i><Check/></i><span><small>SphexPay</small><b>Venda aprovada com sucesso</b><em>Pix · R$ 284,90</em></span><time>agora</time></article><article><i><Bell/></i><span><small>Resumo da operação</small><b>Sua sequência foi concluída</b><em>5 notificações processadas</em></span><time>12:42</time></article><article><i><Sparkles/></i><span><small>Mensagem inteligente</small><b>Uma comunicação para cada momento</b><em>Variação automática ativada</em></span><time>12:40</time></article></div><div data-reveal><span>NOTIFICAÇÕES INTELIGENTES</span><h2>Mensagens que acompanham o ritmo da sua operação.</h2><p>Personalize títulos e conteúdos, escolha dispositivos e programe sequências com uma experiência clara, previsível e organizada.</p><ul><li><Check/> Personalização de título e mensagem</li><li><Check/> Agendamento e sequências controladas</li><li><Check/> Variações inteligentes com fallback seguro</li></ul></div></section>
   <section className="security-section" id="seguranca"><div className="security-visual" data-reveal><div><ShieldCheck/><i/><i/><i/></div><span>CAMADA DE PROTEÇÃO</span></div><div data-reveal><span>SEGURANÇA DESDE O ACESSO</span><h2>Uma experiência privada antes de mostrar qualquer dado.</h2><p>Autenticação por Supabase Auth, sessão renovável, rotas privadas protegidas e isolamento de credenciais sensíveis fora da interface.</p><div className="security-list"><article><LockKeyhole/><span><b>Autenticação real</b><small>E-mail, senha e provedores sociais quando habilitados.</small></span></article><article><ShieldCheck/><span><b>Rotas protegidas</b><small>O painel só é renderizado depois da validação da sessão.</small></span></article><article><Globe2/><span><b>Conexão HTTPS</b><small>Produção servida pela Vercel com transporte protegido.</small></span></article></div></div></section>
   <section className="rewards-section" id="premiacoes"><div data-reveal><Trophy/><span>RECONHECIMENTO SPHEXPAY</span><h2>Resultados que merecem reconhecimento.</h2><p>A jornada de premiações apresenta os marcos oficiais configurados na plataforma, sem fabricar ganhadores ou resultados públicos.</p></div><div className="reward-track official-reward-track" data-reveal>{revenueAwards.map(award=><article key={award.id}><img src={award.image} width="220" height="160" loading="lazy" alt={`Plaquinha ${award.name}`}/><strong>{award.name}</strong><span>Marco de reconhecimento</span></article>)}</div></section>
   <PublicCompetitionSection destination={accountDestination} authenticated={Boolean(user)}/>
   <section className="integration-section" id="integracoes"><header data-reveal><span>ECOSSISTEMA SPHEXPAY</span><h2>Recursos internos trabalhando no mesmo fluxo.</h2><p>Sem logos ou parceiros fictícios: a experiência conecta apenas módulos confirmados no produto.</p></header><div data-reveal>{['Produtos','Checkouts','Links de pagamento','Clientes','Notificações','Relatórios'].map(item=><span key={item}>{item}</span>)}</div></section>
   <PublicSecurityNote/>
   <PublicFaq/>
   <section className="landing-cta" data-reveal><Sparkles/><span>COMECE COM CLAREZA</span><h2>Seu próximo nível começa com uma operação melhor.</h2><p>Centralize sua gestão, acompanhe seus resultados e construa uma operação preparada para crescer.</p><div><Link className="public-primary" to={accountDestination}>{user?'Acessar meu painel':'Criar minha conta'} <ArrowRight/></Link><Link to="/entrar">Entrar na plataforma</Link></div><small>Cadastre-se e acompanhe sua evolução na Competição SphexPay.</small></section>
  </main>
  <footer className="public-footer"><div><SphexPayLogo showName/><p>Plataforma financeira e inteligência operacional para negócios digitais.</p></div><div><span>Plataforma</span><a href="#plataforma">Produto</a><a href="#recursos">Recursos</a><a href="#seguranca">Segurança</a><a href="#integracoes">Integrações</a></div><div><span>Conta</span><Link to="/entrar">Entrar</Link><Link to="/criar-conta">Criar conta</Link><Link to="/recuperar-senha">Recuperar senha</Link><a href="#campeonato">Competição</a></div><div><span>Informações</span><Link to="/termos">Termos de Uso</Link><Link to="/privacidade">Política de Privacidade</Link><a href="#ajuda">Dúvidas</a></div><small>© {new Date().getFullYear()} SphexPay. Recursos transacionais dependem de integrações oficiais. Nenhum resultado público é simulado nesta página.</small></footer>
 </div>
}
