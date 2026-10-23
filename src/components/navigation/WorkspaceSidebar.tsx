import { useEffect,useState } from 'react'
import { Link,useLocation } from 'react-router-dom'
import { BadgePercent,Gift,ChevronDown,CreditCard,Crown,FileBarChart,Handshake,Landmark,LayoutDashboard,Link2,MessageCircle,Package,PanelLeftClose,PanelLeftOpen,Pin,PinOff,PlugZap,RadioTower,RefreshCcw,Send,Settings,ShieldAlert,ShieldCheck,ShoppingBag,ShoppingCart,Store,TicketPercent,Trophy,Truck,UserRoundCheck,Users,WalletCards,Bell,PackageCheck,type LucideIcon } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { useActiveSeller } from '../../hooks/useActiveSeller'
import { memberCanOpen } from '../../lib/teamAccess'

type Item={id:string;label:string;to:string;icon:LucideIcon;exact?:boolean}
type Group={id:string;label:string;icon:LucideIcon;items:Item[]}

// Menu lateral do computador: agrupa todas as áreas do painel, pode ser recolhido em ícones e
// fixado aberto. No celular segue o dock inferior; em telas médias, a barra superior.
const START:Item[]=[{id:'dashboard',label:'Dashboard',to:'/app',icon:LayoutDashboard,exact:true},{id:'competition',label:'Competição',to:'/app/competicao',icon:Crown}]
const GROUPS:Group[]=[
 {id:'sales',label:'Vendas',icon:ShoppingBag,items:[{id:'transactions',label:'Transações',to:'/app/vendas',icon:ShoppingBag},{id:'shipments',label:'Encomendas',to:'/app/vendas?aba=encomendas',icon:PackageCheck},{id:'disputes',label:'Contestações',to:'/app/vendas?aba=contestacoes',icon:ShieldAlert},{id:'subscriptions',label:'Assinaturas',to:'/app/assinaturas',icon:RefreshCcw},{id:'live',label:'Vendas ao vivo',to:'/app/vendas-ao-vivo',icon:RadioTower}]},
 {id:'products',label:'Produtos',icon:Package,items:[{id:'products',label:'Produtos',to:'/app/produtos',icon:Package,exact:true},{id:'checkout',label:'Checkouts',to:'/app/produtos/checkout',icon:CreditCard},{id:'links',label:'Links de pagamento',to:'/app/produtos/links',icon:Link2},{id:'coupons',label:'Cupons',to:'/app/produtos/cupons',icon:TicketPercent},{id:'shipping',label:'Fretes',to:'/app/produtos/fretes',icon:Truck},{id:'showcase',label:'Vitrine',to:'/app/vitrine',icon:Store}]},
 {id:'finance',label:'Financeiro',icon:Landmark,items:[{id:'finance',label:'Visão geral',to:'/app/financeiro',icon:Landmark,exact:true},{id:'payouts',label:'Saques',to:'/app/financeiro/saques',icon:WalletCards},{id:'charges',label:'Cobranças',to:'/app/financeiro/cobrancas',icon:Send},{id:'fees',label:'Minhas taxas',to:'/app/financeiro/taxas',icon:BadgePercent},{id:'awards',label:'Premiações',to:'/app/premiacoes',icon:Trophy}]},
 {id:'reports',label:'Relatórios',icon:FileBarChart,items:[{id:'reports',label:'Visão geral',to:'/app/relatorios',icon:FileBarChart,exact:true},{id:'customers',label:'Clientes',to:'/app/relatorios/clientes',icon:Users},{id:'carts',label:'Carrinhos abandonados',to:'/app/relatorios/carrinhos',icon:ShoppingCart},{id:'affiliate-report',label:'Afiliados',to:'/app/relatorios/afiliados',icon:Handshake},{id:'referrals',label:'Indicações',to:'/app/relatorios/indicacoes',icon:Gift}]},
 {id:'growth',label:'Crescimento',icon:UserRoundCheck,items:[{id:'affiliates',label:'Afiliados',to:'/app/afiliados',icon:UserRoundCheck},{id:'social',label:'Social',to:'/app/social',icon:MessageCircle}]},
 {id:'account',label:'Conta',icon:Settings,items:[{id:'verification',label:'Verificação',to:'/app/verificacao',icon:ShieldCheck},{id:'integrations',label:'Integrações',to:'/app/integracoes',icon:PlugZap},{id:'notifications',label:'Notificações',to:'/app/notificacoes',icon:Bell},{id:'settings',label:'Configurações',to:'/app/configuracoes',icon:Settings}]},
]
const STORAGE='sphex-sidebar'
type Prefs={pinned:boolean;closed:string[]}
const readPrefs=():Prefs=>{try{const value=JSON.parse(localStorage.getItem(STORAGE)||'null') as Partial<Prefs>|null;return{pinned:value?.pinned!==false,closed:Array.isArray(value?.closed)?value.closed.filter(item=>typeof item==='string'):[]}}catch{return{pinned:true,closed:[]}}}

function isSidebarItemActive(item:Item,pathname:string,search:string){
 const [path,query]=item.to.split('?'),tab=new URLSearchParams(search).get('aba')
 if(query)return pathname===path&&tab===new URLSearchParams(query).get('aba')
 if(path==='/app/vendas')return(pathname===path||pathname.startsWith(`${path}/`))&&!tab
 return item.exact?pathname===path:pathname===path||pathname.startsWith(`${path}/`)
}

export function WorkspaceSidebar({navigationRoot='/app'}:{navigationRoot?:string}){
 const {t}=useTranslation(),{pathname,search}=useLocation(),appPath=pathname.replace(navigationRoot,'/app')
 const [prefs,setPrefs]=useState<Prefs>(readPrefs),[hover,setHover]=useState(false)
 useEffect(()=>{try{localStorage.setItem(STORAGE,JSON.stringify(prefs))}catch{/* Preferência só desta sessão. */}},[prefs])
 const expanded=prefs.pinned||hover
 // Colaborador vê só as áreas do cargo na conta de quem convidou.
 const role=useActiveSeller().workspace?.role,allowed=(item:Item)=>memberCanOpen(role,item.to.split('?')[0],item.to.includes('?')?`?${item.to.split('?')[1]}`:'')
 const groups=GROUPS.map(group=>({...group,items:group.items.filter(allowed)})).filter(group=>group.items.length)
 const link=(item:Item)=>{const active=isSidebarItemActive(item,appPath,search);return <Link key={`${item.id}:${item.to}`} to={item.to.replace(/^\/app/,navigationRoot)} aria-current={active?'page':undefined} className={`workspace-sidebar-link${active?' active':''}`} title={expanded?undefined:t(item.label)}><item.icon aria-hidden="true"/><span>{t(item.label)}</span></Link>}
 const toggleGroup=(id:string)=>setPrefs(current=>({...current,closed:current.closed.includes(id)?current.closed.filter(item=>item!==id):[...current.closed,id]}))
 return <aside className={`workspace-sidebar${expanded?' expanded':' collapsed'}${prefs.pinned?' pinned':''}`} aria-label={t('Menu lateral')} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onFocus={()=>setHover(true)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setHover(false)}}>
  <nav className="workspace-sidebar-scroll" aria-label={t('Navegação principal')}>
   <div className="workspace-sidebar-group">{START.filter(allowed).map(link)}</div>
   {groups.map(group=>{const open=!prefs.closed.includes(group.id)||group.items.some(item=>isSidebarItemActive(item,appPath,search));return <div key={group.id} className="workspace-sidebar-group">
    <button type="button" className="workspace-sidebar-heading" aria-expanded={open} onClick={()=>toggleGroup(group.id)} title={expanded?undefined:t(group.label)}><group.icon aria-hidden="true"/><span>{t(group.label)}</span><ChevronDown aria-hidden="true" className="workspace-sidebar-chevron"/></button>
    {open&&<div className="workspace-sidebar-items">{group.items.map(link)}</div>}
   </div>})}
  </nav>
  <button type="button" className="workspace-sidebar-pin" onClick={()=>setPrefs(current=>({...current,pinned:!current.pinned}))} aria-pressed={prefs.pinned} aria-label={t(prefs.pinned?'Recolher menu':'Fixar menu aberto')}>{prefs.pinned?<PanelLeftClose aria-hidden="true"/>:<PanelLeftOpen aria-hidden="true"/>}<span>{t(prefs.pinned?'Recolher menu':'Fixar menu aberto')}</span>{prefs.pinned?<PinOff aria-hidden="true" className="workspace-sidebar-pin-icon"/>:<Pin aria-hidden="true" className="workspace-sidebar-pin-icon"/>}</button>
 </aside>
}
