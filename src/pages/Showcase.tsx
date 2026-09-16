import { ArrowRight, Check, CheckCircle2, ImageIcon, LockKeyhole, Package, Plus, RefreshCw, Search, Store, TrendingUp, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { money } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { getProductShowcaseEligibility, SHOWCASE_TARGET_CENTS, type ShowcaseProduct, type ShowcaseStatus } from '../features/showcase/showcaseEligibility'
import { showcaseError, showcaseService } from '../features/showcase/showcaseService'
import '../features/showcase/showcase.css'

const labels: Record<ShowcaseStatus, string> = { locked: 'Bloqueado', eligible: 'Elegível', published: 'Publicado' }
const filters = ['all', 'published', 'eligible', 'locked'] as const
const filterLabels = { all: 'Todos', published: 'Publicados', eligible: 'Elegíveis', locked: 'Bloqueados' }

function ProductImage({ product }: { product: ShowcaseProduct }) {
 const [failed, setFailed] = useState(false)
 return <div className="vitrine-image">{product.imageUrl && !failed
  ? <img src={product.imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
  : <ImageIcon aria-hidden="true" />}</div>
}

function ProductCard({ product, busy, onPublish, published = false }: {
 product: ShowcaseProduct; busy: string | null; onPublish: (product: ShowcaseProduct, publish: boolean) => void; published?: boolean
}) {
 const eligibility = getProductShowcaseEligibility(product.grossSalesCents, product.publishedAt)
 const isPublished = product.status === 'published'
 const hasPublication = Boolean(product.publishedAt)
 const working = busy === product.id
 return <article className={`vitrine-card is-${product.status}`} aria-label={product.name}>
  <div className="vitrine-card-top"><ProductImage key={product.imageUrl} product={product} /><span className={`vitrine-badge is-${product.status}`}>
   {isPublished ? <Check size={12} /> : eligibility.eligible ? <CheckCircle2 size={12} /> : <LockKeyhole size={12} />}{labels[product.status]}</span></div>
  <div className="vitrine-card-copy"><span className="vitrine-category">{product.category}</span><h3>{product.name}</h3>
   {!published && <div className="vitrine-progress-block">
    <div className="vitrine-progress-label"><strong>{money(product.grossSalesCents / 100)}</strong><span>de {money(SHOWCASE_TARGET_CENTS / 100)}</span></div>
    <progress aria-label={`Progresso de ${product.name}`} value={eligibility.progress} max={100} />
    <p>{eligibility.eligible ? 'Meta alcançada. Seu produto conquistou este espaço.' : `Faltam ${money(eligibility.remainingCents / 100)} para liberar este produto na vitrine.`}</p>
   </div>}
   {published && <p className="vitrine-published-note"><CheckCircle2 size={15} /> Publicado na sua vitrine</p>}
   <button type="button" className={`vitrine-button ${hasPublication ? 'is-secondary' : 'is-primary'}`} disabled={busy !== null || (!eligibility.eligible && !hasPublication)}
    aria-busy={working} onClick={() => onPublish(product, !hasPublication)}>
    {working ? <RefreshCw size={16} /> : hasPublication ? <X size={16} /> : eligibility.eligible ? <Plus size={16} /> : <LockKeyhole size={16} />}
    {working ? 'Salvando...' : hasPublication ? 'Remover da vitrine' : 'Adicionar à vitrine'}
   </button>
  </div>
 </article>
}

function PlayerShowcase({ userId }: { userId: string }) {
 const [products, setProducts] = useState<ShowcaseProduct[]>([])
 const [loading, setLoading] = useState(true)
 const [error, setError] = useState('')
 const [notice, setNotice] = useState('')
 const [busy, setBusy] = useState<string | null>(null)
 const [filter, setFilter] = useState<(typeof filters)[number]>('all')
 const [query, setQuery] = useState('')
 const management = useRef<HTMLElement>(null)
 const mounted = useRef(false), request = useRef(0), saving = useRef(false)
 const refresh = useCallback(async () => {
  const version = ++request.current
  setLoading(true)
  try {
   const rows = await showcaseService.list()
   if (mounted.current && version === request.current) { setProducts(rows); setError('') }
  } catch (reason) {
   if (mounted.current && version === request.current) setError(showcaseError(reason))
  } finally {
   if (mounted.current && version === request.current) setLoading(false)
  }
 }, [])
 useEffect(() => {
  mounted.current = true
  void refresh()
  const update = () => { if (!saving.current) void refresh() }
  const channel = supabase?.channel(`showcase-${userId}`)
   .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_transactions', filter: `user_id=eq.${userId}` }, update)
   .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `seller_id=eq.${userId}` }, update).subscribe()
  window.addEventListener('focus', update)
  return () => { mounted.current = false; window.removeEventListener('focus', update); if (channel) void supabase?.removeChannel(channel) }
 }, [refresh, userId])
 const publish = async (product: ShowcaseProduct, value: boolean) => {
  if (saving.current) return
  saving.current = true; setBusy(product.id); setNotice(''); setError('')
  ++request.current
  try {
   await showcaseService.setPublished(product.id, value)
   if (!mounted.current) return
   const rows = await showcaseService.list()
   if (!mounted.current) return
   setProducts(rows)
   setNotice(value ? `${product.name} foi adicionado à vitrine.` : `${product.name} foi removido da vitrine.`)
  } catch (reason) {
   if (mounted.current) setError(showcaseError(reason))
  } finally {
   saving.current = false
   if (mounted.current) { setBusy(null); setLoading(false) }
  }
 }
 const counts = useMemo(() => products.reduce((result, product) => { result[product.status]++; return result }, { published: 0, eligible: 0, locked: 0 }), [products])
 const published = products.filter(product => product.status === 'published')
 const visible = products.filter(product => (filter === 'all' || product.status === filter) && `${product.name} ${product.category}`.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')))
 const seeEligible = () => { setFilter('eligible'); setQuery(''); management.current?.scrollIntoView({ block: 'start' }); management.current?.focus({ preventScroll: true }) }
 return <div className="vitrine-page">
  <header className="vitrine-heading"><div><span className="vitrine-eyebrow">CRESCIMENTO QUE GANHA VISIBILIDADE</span><h1>Vitrine</h1></div><button type="button" className="vitrine-button is-secondary" onClick={() => void refresh()} disabled={loading || busy !== null}><RefreshCw size={15} />{loading ? 'Atualizando...' : 'Atualizar'}</button></header>
  <section className="vitrine-hero" aria-labelledby="vitrine-hero-title"><div className="vitrine-hero-copy"><span className="vitrine-hero-label"><Store size={16} /> SEU PRÓXIMO ESPAÇO</span><h2 id="vitrine-hero-title">Resultados abrem portas.<br /><span>Seu produto merece ser visto.</span></h2><p>Conquiste {money(1000)} em vendas aprovadas por produto e escolha o que vai para a sua vitrine.</p><div className="vitrine-rule"><TrendingUp size={16} /><span>Vendas reais. Conquistas por produto.</span></div></div>
   <dl className="vitrine-summary">{(['published', 'eligible', 'locked'] as const).map(status => <div key={status}><dt>{filterLabels[status]}</dt><dd>{loading || error ? '—' : counts[status].toString().padStart(2, '0')}</dd></div>)}</dl>
  </section>
  {notice && <div className="vitrine-toast" role="status"><CheckCircle2 size={18} /><span>{notice}</span><button type="button" aria-label="Fechar confirmação" onClick={() => setNotice('')}><X size={16} /></button></div>}
  {error ? <div className="vitrine-error" role="alert"><strong>Não foi possível carregar a vitrine</strong><p>{error}</p><button className="vitrine-button is-secondary" disabled={loading || busy !== null} onClick={() => void refresh()}>Tentar novamente</button></div>
   : loading && !products.length ? <div className="vitrine-loading" role="status"><Store size={28} /><p>Carregando seus produtos e suas conquistas...</p></div>
   : <>
    <section className="vitrine-section" aria-labelledby="vitrine-published-title"><div className="vitrine-section-heading"><div><span className="vitrine-eyebrow">01 / SUA SELEÇÃO</span><h2 id="vitrine-published-title">Vitrine publicada</h2></div><span className="vitrine-count">{counts.published} {counts.published === 1 ? 'produto' : 'produtos'}</span></div>
     {published.length ? <div className="vitrine-grid">{published.map(product => <ProductCard key={product.id} product={product} busy={busy} onPublish={publish} published />)}</div>
      : <div className="vitrine-empty"><div className="vitrine-empty-symbol" aria-hidden="true"><Store size={32} /><span><LockKeyhole size={13} /></span></div><span className="vitrine-eyebrow">UM NOVO PALCO PARA SUAS CONQUISTAS</span><h3>Sua vitrine ainda está vazia</h3><p>Quando seus produtos alcançarem R$ 1.000,00 em vendas, você poderá publicá-los aqui para ganhar mais visibilidade.</p><div className="vitrine-empty-actions"><button className="vitrine-button is-primary" onClick={seeEligible}>Ver meus produtos elegíveis <ArrowRight size={15} /></button><Link className="vitrine-button is-secondary" to="/app/produtos">Ir para produtos</Link></div><small>Você decide o que publicar. Nada entra automaticamente.</small></div>}
    </section>
    <section className="vitrine-section" ref={management} tabIndex={-1} aria-labelledby="vitrine-management-title"><div className="vitrine-section-heading"><div><span className="vitrine-eyebrow">02 / ACOMPANHE SUA EVOLUÇÃO</span><h2 id="vitrine-management-title">Meus produtos para vitrine</h2><p>Cada produto tem sua própria meta. Confira o progresso e libere o próximo.</p></div></div>
     <div className="vitrine-toolbar"><div className="vitrine-filters" role="group" aria-label="Filtrar produtos por status">{filters.map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{filterLabels[value]}<span>{value === 'all' ? products.length : counts[value]}</span></button>)}</div><label className="vitrine-search"><Search size={16} /><input aria-label="Buscar meus produtos" placeholder="Buscar produto ou categoria" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
     {visible.length ? <div className="vitrine-grid" aria-busy={loading}>{visible.map(product => <ProductCard key={product.id} product={product} busy={busy} onPublish={publish} />)}</div>
      : <div className="vitrine-no-results"><Package size={28} /><h3>{products.length ? 'Nenhum produto neste filtro' : 'Sua próxima conquista começa com um produto'}</h3><p>{products.length ? 'Experimente outro status ou ajuste sua busca.' : 'Cadastre seus produtos e acompanhe aqui o caminho até a vitrine.'}</p>{products.length ? <button className="vitrine-button is-secondary" onClick={() => { setFilter('all'); setQuery('') }}>Ver todos os produtos</button> : <Link className="vitrine-button is-primary" to="/app/produtos">Ir para produtos <ArrowRight size={15} /></Link>}</div>}
     <p className="vitrine-footnote">Consideramos vendas aprovadas em reais, após descontos e antes das taxas. Reembolsos e chargebacks não contam. A visibilidade depende de manter a meta de R$ 1.000,00.</p>
    </section>
   </>}
 </div>
}

export default function Showcase() {
 const { user, loading } = useAuth()
 if (loading) return <div className="vitrine-loading" role="status">Validando acesso...</div>
 if (!user) return <div className="vitrine-error" role="alert">Entre na sua conta para acessar a vitrine.</div>
 return <PlayerShowcase key={user.id} userId={user.id} />
}
