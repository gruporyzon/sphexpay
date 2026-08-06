import { useEffect,useRef,useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu,Search,X } from 'lucide-react'
import { SphexPayLogo } from '../branding/SphexPayLogo'
import { useAuth } from '../../hooks/useAuth'

const navigation=[
 ['experiencia','Plataforma'],['recursos','Recursos'],['solucoes','Soluções'],
 ['premiacoes','Premiações'],['ajuda','Dúvidas']
] as const

export function PublicHeader(){
 const [open,setOpen]=useState(false),[scrolled,setScrolled]=useState(false),[active,setActive]=useState('')
 const headerRef=useRef<HTMLElement>(null),menuRef=useRef<HTMLButtonElement>(null),wasOpen=useRef(false)
 const {user}=useAuth(),destination=user?(user.user_metadata?.onboarding_complete?'/app':'/onboarding'):'/criar-conta'
 useEffect(()=>{
  const update=()=>setScrolled(scrollY>24)
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)}
  const outside=(event:PointerEvent)=>{if(open&&!headerRef.current?.contains(event.target as Node))setOpen(false)}
  update();addEventListener('scroll',update,{passive:true});addEventListener('keydown',escape);document.addEventListener('pointerdown',outside)
  return()=>{removeEventListener('scroll',update);removeEventListener('keydown',escape);document.removeEventListener('pointerdown',outside)}
 },[open])
 useEffect(()=>{
  const sections=navigation.map(([id])=>document.getElementById(id)).filter((item):item is HTMLElement=>Boolean(item))
  let observer:IntersectionObserver|null=null
  const observe=()=>{
   observer?.disconnect()
   const headerHeight=Math.ceil(headerRef.current?.getBoundingClientRect().height??72)
   observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)setActive(entry.target.id)}),{rootMargin:`-${headerHeight+16}px 0px -55% 0px`,threshold:0})
   sections.forEach(section=>observer?.observe(section))
  }
  observe();addEventListener('resize',observe,{passive:true})
  return()=>{removeEventListener('resize',observe);observer?.disconnect()}
 },[])
 useEffect(()=>{
  document.body.style.overflow=open&&innerWidth<=900?'hidden':''
  if(wasOpen.current&&!open)menuRef.current?.focus()
  wasOpen.current=open
  return()=>{document.body.style.overflow=''}
 },[open])
 const close=()=>setOpen(false)
 return <header ref={headerRef} className={`public-header public-header-redesign public-header-hero ${scrolled?'scrolled':''}`}>
  <div className="public-header-inner">
   <Link to="/" className="public-logo" aria-label="Sphex — página inicial"><SphexPayLogo showName shortName priority/></Link>
   <nav id="public-navigation" className={open?'open':''} aria-label="Navegação principal">{navigation.map(([id,label])=><a key={id} href={`#${id}`} aria-current={active===id?'location':undefined} onClick={()=>{setActive(id);close()}}>{label}</a>)}<button className="public-search" type="button" aria-label="Buscar na página"><Search/></button><div className="public-mobile-actions"><Link to="/entrar" onClick={close}>Entrar</Link><Link className="public-primary" to={destination} onClick={close}>{user?'Acessar painel':'Criar conta'}</Link></div></nav>
   <div className="public-actions"><Link to="/entrar">Entrar</Link><Link className="public-primary" to={destination}>{user?'Acessar painel':'Criar conta'}</Link></div>
   <button ref={menuRef} className="public-menu" onClick={()=>setOpen(value=>!value)} aria-label={open?'Fechar menu':'Abrir menu'} aria-expanded={open} aria-controls="public-navigation">{open?<X/>:<Menu/>}</button>
  </div>
 </header>
}
