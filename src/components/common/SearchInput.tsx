import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Search, Settings, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { competitionNavigation, navigationItems } from '../../config/navigation'

const destinations = [...navigationItems, competitionNavigation, { id: 'settings', label: 'Configurações', path: '/app/configuracoes', icon: Settings, group: 'Conta' }]
export function SearchInput({ navigationRoot = '/app' }: { navigationRoot?: string }) {
  const [query, setQuery] = useState(''), [open, setOpen] = useState(false), root = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null), navigate = useNavigate()
  const matches = destinations.filter(item => item.label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()))
  const go = (path: string) => { setOpen(false); setQuery(''); navigate(path.replace(/^\/app/, navigationRoot)) }
  useEffect(() => {
    const pointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const keyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') { event.preventDefault(); setOpen(true); input.current?.focus() }
      if (event.key === 'Escape') { setOpen(false); input.current?.blur() }
    }
    addEventListener('pointerdown', pointer); addEventListener('keydown', keyboard)
    return () => { removeEventListener('pointerdown', pointer); removeEventListener('keydown', keyboard) }
  }, [])
  return <div className="workspace-search" ref={root}><label className="top-search"><Search aria-hidden="true" /><span className="sr-only">Buscar módulos</span><input ref={input} type="search" aria-label="Buscar módulos" placeholder="Buscar na plataforma..." autoComplete="off" value={query} onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true) }} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); root.current?.querySelector<HTMLButtonElement>('.workspace-search-result')?.focus() } if (event.key === 'Enter' && matches[0]) go(matches[0].path) }} /><kbd>⌘ K</kbd></label>{open && <section className="workspace-search-results" aria-label="Resultados de navegação"><header><span>{query ? 'Resultados' : 'Acesso rápido'}</span><button aria-label="Fechar busca" onClick={() => setOpen(false)}><X /></button></header>{matches.length ? matches.map(item => <button className="workspace-search-result" key={item.id} aria-label={`Abrir ${item.label}`} onClick={() => go(item.path)}><item.icon /><span>{item.label}<small>{item.group}</small></span><ArrowUpRight /></button>) : <p>Nenhum módulo encontrado.</p>}</section>}</div>
}
