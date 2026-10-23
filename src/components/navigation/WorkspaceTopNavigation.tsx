import {useTranslation} from '../../i18n'
import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CreditCard, LayoutGrid, Link2, Settings } from 'lucide-react'
import { competitionNavigation, navigationItems } from '../../config/navigation'
import { useActiveSeller } from '../../hooks/useActiveSeller'
import { memberCanOpen } from '../../lib/teamAccess'

const dashboard = navigationItems.find(item=>item.id==='dashboard')!
const workspaceTopItems = [
  {...dashboard,label:'Dashboard',icon:LayoutGrid},
  navigationItems.find(item=>item.id==='products')!,
  {id:'checkout',label:'Checkouts',path:'/app/produtos/checkout',icon:CreditCard},
  {id:'links',label:'Links de pagamento',path:'/app/produtos/links',icon:Link2},
  ...navigationItems.filter(item=>!['dashboard','products'].includes(item.id)),
  competitionNavigation,
  {id:'settings',label:'Configurações',path:'/app/configuracoes',icon:Settings},
]
// No celular estes três ficam no menu flutuante e saem desta barra (ver floating-nav.css).
const DOCKED=new Set(['dashboard','live-sales','finance'])
export function WorkspaceTopNavigation({navigationRoot='/app'}:{navigationRoot?:string}){
 const {t}=useTranslation(),role=useActiveSeller().workspace?.role

 const nav=useRef<HTMLElement>(null),{pathname}=useLocation()
 useEffect(()=>{
  const active=nav.current?.querySelector<HTMLElement>('[aria-current="page"]')
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches
  active?.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:reduced?'instant':'smooth'})
 },[pathname])
 useEffect(()=>{
  const element=nav.current;if(!element)return
  const wheel=(event:WheelEvent)=>{if(Math.abs(event.deltaY)>Math.abs(event.deltaX)&&element.scrollWidth>element.clientWidth){const max=element.scrollWidth-element.clientWidth;if(event.deltaY<0&&element.scrollLeft<=0||event.deltaY>0&&element.scrollLeft>=max)return;event.preventDefault();element.scrollLeft+=event.deltaY}}
  element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel)
 },[])
 const appPath=pathname.replace(navigationRoot,'/app')
 return <div className="reference-navigation-wrap"><nav ref={nav} className="reference-navigation" aria-label={t('Navegação principal')} onKeyDown={event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return
  const links=[...event.currentTarget.querySelectorAll<HTMLAnchorElement>('a')],index=links.indexOf(document.activeElement as HTMLAnchorElement)
  if(index<0)return;event.preventDefault();const target=event.key==='Home'?0:event.key==='End'?links.length-1:(index+(event.key==='ArrowRight'?1:-1)+links.length)%links.length;links[target]?.focus()
 }}>{workspaceTopItems.filter(item=>memberCanOpen(role,item.path)).map(item=>{
  const path=item.path.replace(/^\/app/,navigationRoot)
  const active=item.id==='products'?appPath==='/app/produtos':'exact' in item&&item.exact?appPath===item.path:appPath===item.path||appPath.startsWith(`${item.path}/`)
  return <Link key={item.id} to={path} data-dock={DOCKED.has(item.id)?'':undefined} aria-current={active?'page':undefined} className={`reference-nav-item${active?' active':''}`}><item.icon aria-hidden="true"/><span>{t(item.label)}</span></Link>
 })}</nav></div>
}
