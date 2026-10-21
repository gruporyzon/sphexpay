import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, CreditCard, Globe, LockKeyhole, Menu, MessageCircle, MoreHorizontal, Play, Search, ShieldCheck, ShoppingCart, Smartphone, Users, X, Zap } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { revenueAwards } from '../../config/revenueAwards'
import { PublicFaq } from '../../components/landing/PublicFaq'
import '../../gateway-landing.css'

const asset = (name: string) => `/gateway/${name}`
const nav = [['home', 'Início'], ['produtos', 'Acessar produtos'], ['taxas', 'Taxas'], ['contact', 'Fale com a Sphex']] as const

function Brand({ symbol = false, className = '' }: { symbol?: boolean; className?: string }) {
  return <span className={`gw-brand ${className}`}><img src="/brand/sphex-symbol-mask.png" alt={symbol ? 'SphexPay' : ''} width="42" height="42" />{!symbol && <span>Sphex<span className="gw-brand-pay">Pay</span></span>}</span>
}

function useGatewayMotion(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const page = root.current
    if (!page) return
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const videos = new Set(page.querySelectorAll('video'))
    const visible = new Set<HTMLVideoElement>()
    const syncVideo = (video: HTMLVideoElement) => {
      if (!preference?.matches && !document.hidden && visible.has(video)) void video.play()?.catch(() => {})
      else video.pause()
    }
    const mediaObserver = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const video = entry.target as HTMLVideoElement
        if (entry.isIntersecting) visible.add(video)
        else visible.delete(video)
        syncVideo(video)
      })
    }, { rootMargin: '120px' }) : null
    videos.forEach(video => mediaObserver?.observe(video))
    const mutation = new MutationObserver(() => {
      page.querySelectorAll('video').forEach(video => {
        if (!videos.has(video)) { videos.add(video); mediaObserver?.observe(video) }
      })
      videos.forEach(video => {
        if (!page.contains(video)) { mediaObserver?.unobserve(video); visible.delete(video); videos.delete(video) }
      })
    })
    mutation.observe(page, { childList: true, subtree: true })
    const appearObserver = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('gw-visible'); appearObserver?.unobserve(entry.target) }
      })
    }, { threshold: .08 }) : null
    page.querySelectorAll('[data-gw-reveal]').forEach(element => {
      if (preference?.matches || !appearObserver) element.classList.add('gw-visible')
      else { element.classList.add('gw-observed'); appearObserver.observe(element) }
    })
    const sync = () => {
      videos.forEach(syncVideo)
      if (preference?.matches) page.querySelectorAll('[data-gw-reveal]').forEach(element => element.classList.add('gw-visible'))
    }
    preference?.addEventListener?.('change', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      mediaObserver?.disconnect(); appearObserver?.disconnect(); mutation.disconnect()
      preference?.removeEventListener?.('change', sync)
      document.removeEventListener('visibilitychange', sync)
      videos.forEach(video => video.pause())
    }
  }, [root])
}

function MotionVideo({ name, className = '' }: { name: string; className?: string }) {
  return <video className={`gw-motion-video ${className}`} src={asset(`${name}.mp4`)} poster={asset(`${name}-poster.jpg`)} muted loop playsInline preload="none" tabIndex={-1} aria-hidden="true" />
}

function Heading({ id, title, children, centered = false }: { id?: string; title: ReactNode; children: ReactNode; centered?: boolean }) {
  return <div className={`gw-section-heading ${centered ? 'gw-heading-centered' : ''}`} data-gw-reveal><h2 id={id}>{title}</h2><p>{children}</p></div>
}

function CheckoutAnimation() {
  return <div className="gw-checkout-animation" aria-hidden="true"><div className="gw-checkout-window"><header><span>Checkout <ChevronDown size={10} /></span><MoreHorizontal size={15} /></header><h4>Seu cliente paga em 1 clique</h4><p>Cartão, PIX e boleto. Uma experiência simples para quem compra, com mais controle para quem vende.</p><Brand symbol /><div className="gw-method-menu"><span><Zap /> PIX <Check /></span><span><CreditCard /> Cartão</span><span><ShoppingCart /> Parcelamento</span></div></div><span className="gw-demo-cursor"><ArrowUpRight /></span></div>
}

function PhoneAnimation({ compact = false }: { compact?: boolean }) {
  return <div className={`gw-phone-scene ${compact ? 'gw-phone-compact' : ''}`} aria-hidden="true"><div className="gw-phone"><div className="gw-phone-status"><span>12:00</span><i /><Smartphone size={11} /></div><header><ChevronLeft size={20} /><span className="gw-chat-avatar"><Brand symbol /></span><b>SphexPay</b><span className="gw-chat-header-icons"><Smartphone size={15} /><MoreHorizontal size={18} /></span></header><div className="gw-chat"><small>Hoje</small><div className="gw-bubble">Olá! Você começou sua compra e ainda pode finalizar.<br /> <br /> Seu checkout ficou salvo. Retome de onde parou.<span>12:00 <Check size={11} /></span><b className="gw-message-cta">Continuar minha compra <ArrowRight size={12} /></b></div><div className="gw-bubble gw-bubble-sent">Quero continuar!<span>12:01 <Check size={11} /></span></div><div className="gw-bubble gw-bubble-last">Tudo pronto. Seu link está aqui para você concluir com tranquilidade.<span>12:01 <Check size={11} /></span></div></div><footer><span>Mensagem</span><MessageCircle size={17} /></footer></div></div>
}

const showcase = [
  { image: 'members-course-1.webp', name: 'Infoprodutos', text: 'Do primeiro conteúdo ao próximo lançamento.' },
  { image: 'members-course-2.webp', name: 'Criadores', text: 'Transforme conhecimento em novas possibilidades.' },
  { image: 'members-course-3.webp', name: 'Negócios digitais', text: 'Uma experiência conectada à sua operação.' },
  { image: 'members-course-4.webp', name: 'Mentorias', text: 'Organize sua entrega e acompanhe sua evolução.' },
  { image: 'members-course-5.webp', name: 'Comunidades', text: 'Mais proximidade em cada etapa da jornada.' },
]

function BusinessCarousel({ destination }: { destination: string }) {
  const [paused, setPaused] = useState(false)
  return <section className="gw-business" aria-labelledby="gw-business-title"><div className="gw-container"><Heading id="gw-business-title" title="Seu negócio, no próximo nível" centered>Uma experiência para diferentes formas de empreender no digital.<br /> Conheça as possibilidades da SphexPay.</Heading></div><div className={`gw-carousel-viewport ${paused ? 'gw-carousel-paused' : ''}`} role="region" aria-label="Possibilidades para seu negócio" tabIndex={0}><div className="gw-business-track">{[...showcase, ...showcase].map((card, i) => <article className="gw-business-card" key={`${card.name}-${i}`} aria-hidden={i >= showcase.length || undefined}><img src={asset(card.image)} alt="" width="320" height="420" loading="lazy" /><div><h3>{card.name} <ShieldCheck size={12} /></h3><p>{card.text}</p><Link to={destination} tabIndex={i >= showcase.length ? -1 : 0}>Conhecer <ArrowUpRight size={12} /></Link></div></article>)}</div></div><div className="gw-business-bottom gw-container"><p>Checkout, produtos e acompanhamento de vendas.<br /> Seu próximo passo começa em um só lugar.</p><Link className="gw-button" to={destination}>Começar agora</Link><button type="button" className="gw-carousel-pause" aria-label={paused ? 'Reproduzir carrossel' : 'Pausar carrossel'} aria-pressed={paused} onClick={() => setPaused(value => !value)}><Play size={15} /></button></div></section>
}

function Recovery({ destination }: { destination: string }) {
  const [tab, setTab] = useState(0)
  const labels = ['Jornada de compra', 'Funil e checkout']
  return <section className="gw-recovery gw-container" id="solucoes" aria-labelledby="gw-recovery-title"><Heading id="gw-recovery-title" title={<>Cada etapa da compra,<br /> com mais possibilidades</>} centered>Acompanhe o caminho entre o interesse e a venda.<br /> Checkout e informações organizados na mesma plataforma.</Heading><div className="gw-segment" role="tablist" aria-label="Explorar jornada de venda">{labels.map((label, i) => <button key={label} id={`gw-recovery-tab-${i}`} role="tab" type="button" aria-selected={tab === i} aria-controls={`gw-recovery-panel-${i}`} tabIndex={tab === i ? 0 : -1} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); const next = tab === 0 ? 1 : 0; setTab(next); document.getElementById(`gw-recovery-tab-${next}`)?.focus() } }} onClick={() => setTab(i)}>{i === 0 && <MessageCircle size={14} />}{label}</button>)}</div><div role="tabpanel" id={`gw-recovery-panel-${tab}`} aria-labelledby={`gw-recovery-tab-${tab}`} tabIndex={0} className="gw-recovery-grid" key={tab}>{(tab === 0 ? [
    ['pix', 'PIX gerado e não pago', 'Acompanhe o status dos pagamentos e identifique o que ainda está pendente.'],
    ['card', 'Cartão recusado', 'Visualize tentativas de pagamento e o contexto de cada transação.'],
    ['cart', 'Carrinho abandonado', 'Uma jornada de compra clara, do produto até a conclusão do pedido.'],
  ] : [
    ['pix', 'Métodos de pagamento', 'Uma experiência de compra com opções organizadas para o seu cliente.'],
    ['card', 'Checkout personalizável', 'Apresente sua oferta com uma página alinhada à identidade do negócio.'],
    ['cart', 'Acompanhe cada etapa', 'Consulte seus pedidos e acompanhe o andamento das vendas no painel.'],
  ]).map(([name, title, description], i) => <article className="gw-panel gw-recovery-card" key={name}><div className="gw-recovery-visual"><MotionVideo name={name} />{i === 2 && <PhoneAnimation compact />}</div><div className="gw-panel-copy"><h3>{title}</h3><p>{description}</p></div></article>)}</div><Link className="gw-text-link" to={destination}>Conheça sua próxima plataforma <ArrowRight size={14} /></Link></section>
}

function Integrations({ destination }: { destination: string }) {
  const nodes = [<ShoppingCart />, <CreditCard />, <Globe />, <Zap />, <MessageCircle />, <Users />, <LockKeyhole />, <Search />]
  return <section className="gw-integrations" id="integracoes" aria-labelledby="gw-integrations-title"><div className="gw-integration-orbit" aria-hidden="true"><div className="gw-orbit-ring gw-orbit-ring-1" /><div className="gw-orbit-ring gw-orbit-ring-2" /><div className="gw-orbit-ring gw-orbit-ring-3" />{nodes.map((icon, i) => <div className={`gw-orbit-node gw-orbit-node-${i}`} key={i}>{icon}</div>)}</div><div className="gw-integration-copy" data-gw-reveal><span className="gw-eyebrow">Integrações</span><h2 id="gw-integrations-title">Conectado com as<br /> ferramentas que você já usa</h2><p>Produtos, checkout e dados da operação.<br /> Uma experiência para conectar cada parte do seu negócio.</p><Link className="gw-button" to={destination}>Conhecer a plataforma</Link></div></section>
}

function Members() {
  return <section className="gw-members gw-container" id="experiencia" aria-labelledby="gw-members-title"><div className="gw-members-surface"><Heading id="gw-members-title" title={<>Sua área de membros<br /> no padrão que o aluno espera</>}>Organize produtos e conteúdos em uma experiência visual<br /> que acompanha seu negócio e valoriza cada entrega.</Heading><div className="gw-members-app" aria-label="Prévia ilustrativa da área de membros"><aside><Brand /><div><span>Início</span><span>Meus conteúdos</span><span>Meu perfil</span></div><small>Prévia da área de membros</small></aside><div className="gw-members-main"><header><Search size={15} /><span>Explore seus conteúdos</span><span className="gw-member-avatar">S</span></header><div className="gw-members-banner"><img src={asset('members-banner.webp')} width="1260" height="347" loading="lazy" alt="Banner de conteúdos da área de membros" /><Brand symbol /></div><h3>Seus módulos</h3><div className="gw-members-courses">{Array.from({ length: 5 }, (_, i) => <img key={i} src={asset(`members-course-${i + 1}.webp`)} width="205" height="330" alt={`Prévia de capa do módulo ${i + 1}`} loading="lazy" />)}</div></div></div></div></section>
}

function Rewards() {
  const [index, setIndex] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  const select = (next: number) => {
    const value = Math.max(0, Math.min(revenueAwards.length - 1, next))
    setIndex(value)
    const target = track.current?.children[value] as HTMLElement | undefined
    if (target && track.current) track.current.scrollTo({ left: target.offsetLeft - track.current.offsetLeft, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  return <section className="gw-rewards" id="premiacoes" aria-labelledby="gw-rewards-title"><div className="gw-container"><Heading id="gw-rewards-title" title={<><span className="gw-title-desktop">Cada marco de faturamento,<br /> uma recompensa</span><span className="gw-title-mobile">Cada marco<br /> de faturamento,<br /> uma recompensa</span></>}>O próximo capítulo da sua jornada merece reconhecimento.<br /> Conheça as premiações oficiais da SphexPay.</Heading><div className="gw-reward-nav" role="group" aria-label="Selecionar premiação">{revenueAwards.map((award, i) => <button type="button" key={award.id} aria-pressed={index === i} onClick={() => select(i)}>Premiação {award.name.replace('Sphex ', '')}</button>)}</div><div className="gw-reward-track" ref={track} role="region" aria-label="Premiações SphexPay" tabIndex={0} onScroll={() => { const items = [...(track.current?.children ?? [])] as HTMLElement[]; if (track.current && items.length) { const left = track.current.scrollLeft; const nearest = items.reduce((best, item, i) => Math.abs(item.offsetLeft - items[0].offsetLeft - left) < Math.abs(items[best].offsetLeft - items[0].offsetLeft - left) ? i : best, 0); setIndex(nearest) } }}>{revenueAwards.map(award => <article className="gw-reward-card" key={award.id}><span><Brand symbol /> Premiação {award.name.replace('Sphex ', '')}</span><img src={award.image} width="320" height="380" alt={`Placa oficial ${award.name}`} loading="lazy" /><div><h3>{award.name}</h3><p>{award.description}</p></div></article>)}</div><div className="gw-reward-controls"><button type="button" onClick={() => select(index - 1)} disabled={index === 0} aria-label="Premiação anterior"><ChevronLeft /></button><span>{String(index + 1).padStart(2, '0')} / 05</span><button type="button" onClick={() => select(index + 1)} disabled={index === revenueAwards.length - 1} aria-label="Próxima premiação"><ChevronRight /></button></div></div></section>
}

function Affiliates() {
  return <section className="gw-affiliates gw-container" aria-labelledby="gw-affiliates-title"><Heading id="gw-affiliates-title" title={<>Afiliados e coprodutores,<br /> com tudo em um só lugar</>}>Organize parcerias, acompanhe comissões e visualize<br /> a performance da sua operação no painel SphexPay.</Heading><div className="gw-affiliate-grid">{[['market', 'Produtos e ofertas'], ['split', 'Divisão e comissões'], ['metrics', 'Visão de performance'], ['team', 'Parceiros e equipe']].map(([name, label]) => <figure key={name} data-gw-reveal><img src={asset(`affiliate-${name}.webp`)} width="320" height="440" loading="lazy" alt={label} /><figcaption>{label}</figcaption></figure>)}</div><div className="gw-operation-grid"><article className="gw-operation-card"><MotionVideo name="migration" /><div><h3>Seu próximo passo,<br /> com mais simplicidade</h3><p>Crie sua conta e conheça os recursos disponíveis para organizar sua operação na SphexPay.</p></div></article><article className="gw-operation-card"><MotionVideo name="security" /><div><h3>Segurança e controle<br /> em cada acesso</h3><p>Autenticação, proteção de acesso e informações organizadas para acompanhar sua conta.</p></div></article></div></section>
}

function Pricing({ destination }: { destination: string }) {
  return <section className="gw-pricing gw-container" id="taxas" aria-labelledby="gw-pricing-title"><Heading id="gw-pricing-title" title={<>Uma operação que acompanha<br /> o tamanho do seu negócio</>} centered>Conheça as condições disponíveis para o seu perfil.<br /> Consulte as taxas e os prazos aplicáveis antes de ativar sua operação.</Heading><div className="gw-pricing-grid">{[
    ['01', 'Comece sua jornada', 'Sua conta Sphex', 'Conheça produtos, checkout e os recursos do painel.', 'Criar minha conta'],
    ['02', 'Organize sua operação', 'Mais controle', 'Acompanhe vendas, clientes e informações em um único lugar.', 'Conhecer a plataforma'],
    ['03', 'Dê o próximo passo', 'Seu próximo nível', 'Veja as condições e os recursos disponíveis para seu negócio.', 'Ver condições'],
  ].map(([number, badge, title, text, cta]) => <article className="gw-pricing-card gw-panel" key={number} data-gw-reveal><span className="gw-pricing-number">{number}</span><div><small>{badge}</small><h3>{title}</h3><p>{text}</p><Link to={destination}>{cta} <ArrowUpRight size={14} /></Link></div></article>)}</div></section>
}

export default function GatewayLanding() {
  const { user } = useAuth()
  const destination = user ? (user.user_metadata?.onboarding_complete ? '/app' : '/onboarding') : '/criar-conta'
  const root = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useGatewayMotion(root)
  useEffect(() => {
    document.title = 'SphexPay — Um novo nível para o seu negócio'
    const update = () => setScrolled(window.scrollY > 24)
    update(); window.addEventListener('scroll', update, { passive: true })
    const frame = requestAnimationFrame(() => {
      const id = window.location.hash.slice(1)
      if (id) document.getElementById(id)?.scrollIntoView?.({ behavior: 'instant', block: 'start' })
    })
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update) }
  }, [])
  useEffect(() => {
    if (!menuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const trigger = document.activeElement as HTMLElement | null
    menu.current?.querySelector<HTMLElement>('button, a')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
      if (event.key !== 'Tab') return
      const elements = [...(menu.current?.querySelectorAll<HTMLElement>('button, a') ?? [])]
      const first = elements[0], last = elements.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', keydown); trigger?.focus() }
  }, [menuOpen])
  const closeMenu = () => setMenuOpen(false)
  return <div className="spx-gateway" ref={root} id="home"><a href="#gw-main" className="gw-skip">Ir para o conteúdo</a><header className={`gw-header ${scrolled ? 'gw-header-scrolled' : ''}`}><div className="gw-header-inner"><a href="#home" aria-label="SphexPay — início"><Brand /></a><nav className="gw-desktop-nav" aria-label="Navegação principal">{nav.map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}</nav><div className="gw-header-actions"><Link className="gw-button gw-button-outline" to="/entrar">Login</Link><Link className="gw-button" to={destination}>{user ? 'Meu painel' : 'Criar conta'}</Link><button className="gw-menu-trigger" type="button" aria-label="Abrir menu de navegação" aria-expanded={menuOpen} aria-controls="gw-menu" onClick={() => setMenuOpen(true)}><Menu size={21} /></button></div></div></header>
    <div className="gw-menu-backdrop" hidden={!menuOpen} onClick={closeMenu}><div ref={menu} id="gw-menu" role="dialog" aria-modal="true" className="gw-menu-dialog" aria-label="Menu de navegação" onClick={event => event.stopPropagation()}><div><header><Brand /><button type="button" aria-label="Fechar menu" onClick={closeMenu}><X /></button></header><nav>{nav.map(([id, label], i) => <a href={`#${id}`} key={id} onClick={closeMenu}><small>0{i + 1}</small>{label}<ArrowUpRight /></a>)}<a href="#premiacoes" onClick={closeMenu}><small>05</small>Premiações<ArrowUpRight /></a><a href="#ajuda" onClick={() => { setHelpOpen(true); closeMenu() }}><small>06</small>Dúvidas<ArrowUpRight /></a></nav><footer><Link className="gw-button gw-button-outline" to="/entrar" onClick={closeMenu}>Login</Link><Link className="gw-button" to={destination} onClick={closeMenu}>{user ? 'Meu painel' : 'Criar conta'}</Link></footer></div></div></div>
    <main id="gw-main"><section className="gw-hero" aria-labelledby="gw-title"><div className="gw-hero-aura" aria-hidden="true" /><div className="gw-hero-content"><div className="gw-hero-symbol"><Brand symbol /></div><h1 id="gw-title"><span className="gw-title-desktop">Um único ecossistema de<br />  pagamentos, mais possibilidades,<br />  mais gestão, mais controle.</span><span className="gw-title-mobile">Um único<br /> ecossistema<br /> de pagamentos,<br /> mais possibilidades,<br /> mais gestão,<br /> mais controle.</span></h1><p>Checkout, produtos digitais e acompanhamento de vendas<br className="gw-desktop-break" /> reunidos em uma única experiência.<br /> Sua operação no ritmo do próximo nível.</p><Link className="gw-button gw-hero-cta" to={destination}>Quero conhecer a SphexPay</Link></div><a href="#produtos" className="gw-scroll-cue" aria-label="Explorar produtos"><ArrowDown size={15} /></a></section>
      <section className="gw-features gw-container" id="produtos" aria-labelledby="gw-products-title"><Heading id="gw-products-title" title={<><span className="gw-title-desktop">Como a Sphex conecta<br /> cada etapa da sua venda</span><span className="gw-title-mobile">Como a Sphex<br /> conecta cada etapa<br /> da sua venda</span></>}>Da apresentação da oferta ao acompanhamento dos pedidos.<br /> Tenha uma visão da sua operação em uma experiência<br className="gw-desktop-break" /> pensada para simplificar o seu dia.</Heading><div className="gw-features-grid"><article className="gw-panel gw-feature-card" data-gw-reveal><CheckoutAnimation /><div className="gw-panel-copy"><h3>Seu checkout, do seu jeito</h3><p>Uma jornada de compra personalizável, com produtos e métodos de pagamento organizados para o cliente.</p></div></article><article className="gw-panel gw-feature-card gw-phone-feature" data-gw-reveal><PhoneAnimation /><div className="gw-panel-copy"><h3>Uma experiência que continua</h3><p>Acompanhe seus pedidos e tenha contexto sobre o caminho de cada compra. Mais clareza para você e para quem compra.</p></div></article><article className="gw-panel gw-feature-card" data-gw-reveal><MotionVideo name="installments" /><div className="gw-panel-copy"><h3>Mais opções para o seu cliente</h3><p>Consulte as condições de pagamento disponíveis para oferecer uma experiência alinhada ao seu negócio.</p></div></article></div></section>
      <BusinessCarousel destination={destination} /><Recovery destination={destination} /><Integrations destination={destination} /><Members /><Rewards /><Affiliates /><Pricing destination={destination} />
      <section className="gw-final-cta gw-container" id="contact" aria-labelledby="gw-contact-title"><div className="gw-final-surface"><div className="gw-final-copy" data-gw-reveal><h2 id="gw-contact-title">Seu próximo nível<br /> começa na SphexPay</h2><p>Conheça uma nova forma de organizar suas vendas.<br /> Seu negócio, suas possibilidades, uma só plataforma.</p><div><Link className="gw-button" to={destination}>Quero conhecer a SphexPay</Link><Link className="gw-button gw-button-outline" to="/entrar">Login</Link></div></div><Brand symbol className="gw-final-symbol" /></div></section>
      <section className="gw-help gw-container" id="ajuda"><button className="gw-help-toggle" type="button" aria-expanded={helpOpen} aria-controls="gw-help-content" onClick={() => setHelpOpen(value => !value)}>Dúvidas sobre a SphexPay <ChevronDown className={helpOpen ? 'gw-rotated' : ''} size={18} /></button><div id="gw-help-content" hidden={!helpOpen}><PublicFaq sectionId="ajuda-perguntas" /></div></section>
    </main><footer className="gw-footer"><div className="gw-container"><div className="gw-footer-grid"><div><a href="#home" aria-label="Voltar ao início"><Brand /></a><p>Pagamentos e inteligência<br /> para negócios digitais.</p></div><div><span>Menu</span>{nav.map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}</div><div><span>Ajuda</span><a href="#ajuda" onClick={() => setHelpOpen(true)}>Central de ajuda</a><Link to="/recuperar-senha">Recuperar acesso</Link><Link to="/entrar">Minha conta</Link><a href="#premiacoes">Premiações</a></div><div><span>Termos</span><Link to="/termos">Termos de uso</Link><Link to="/privacidade">Política de privacidade</Link></div><div className="gw-footer-message"><p>Uma plataforma para acompanhar sua operação e construir seus próximos passos.</p><Link className="gw-footer-account" to={destination}>Comece com a SphexPay <ArrowUpRight size={14} /></Link></div></div><div className="gw-footer-bottom"><small>SphexPay © {new Date().getFullYear()}</small><small>Uma nova experiência para o seu negócio.</small></div></div></footer></div>
}
