import {Bell,Crown,FileBarChart,Landmark,LayoutDashboard,MessageCircle,Package,PlugZap,RadioTower,RefreshCcw,ShoppingBag,Store,Trophy,UserRoundCheck,type LucideIcon} from 'lucide-react'

export type NavigationItem={id:string;label:string;path:string;icon:LucideIcon;group:string;mobilePrimary?:boolean;exact?:boolean;enabled?:boolean}
export type NavigationGroup={label:string;items:readonly NavigationItem[]}

export const competitionNavigation:NavigationItem={id:'competition',label:'Competição',path:'/app/competicao',icon:Crown,group:'Destaque'}
export const navigationGroups:readonly NavigationGroup[]=[
 {label:'Visão geral',items:[{id:'dashboard',label:'Dashboard',path:'/app',icon:LayoutDashboard,group:'Visão geral',mobilePrimary:true,exact:true},{id:'live-sales',label:'Vendas ao Vivo',path:'/app/vendas-ao-vivo',icon:RadioTower,group:'Visão geral'}]},
 {label:'Operação',items:[{id:'sales',label:'Vendas',path:'/app/vendas',icon:ShoppingBag,group:'Operação'},{id:'products',label:'Produtos',path:'/app/produtos',icon:Package,group:'Operação'},{id:'showcase',label:'Vitrine',path:'/app/vitrine',icon:Store,group:'Operação'},{id:'subscriptions',label:'Assinaturas',path:'/app/assinaturas',icon:RefreshCcw,group:'Operação'}]},
 {label:'Pagamentos',items:[{id:'finance',label:'Financeiro',path:'/app/financeiro',icon:Landmark,group:'Pagamentos',mobilePrimary:true},{id:'integrations',label:'Integrações',path:'/app/integracoes',icon:PlugZap,group:'Pagamentos'}]},
 {label:'Crescimento',items:[{id:'social',label:'Social',path:'/app/social',icon:MessageCircle,group:'Crescimento',mobilePrimary:true},{id:'affiliates',label:'Afiliados',path:'/app/afiliados',icon:UserRoundCheck,group:'Crescimento'},{id:'awards',label:'Premiações',path:'/app/premiacoes',icon:Trophy,group:'Crescimento'},{id:'reports',label:'Relatórios',path:'/app/relatorios',icon:FileBarChart,group:'Crescimento',mobilePrimary:true},{id:'notifications',label:'Notificações',path:'/app/notificacoes',icon:Bell,group:'Crescimento'}]},
] as const

export const navigationItems=navigationGroups.flatMap(group=>group.items).filter(item=>item.enabled!==false)
const primaryOrder=['reports','finance','dashboard','social']
export const primaryMobileNavigation=primaryOrder.map(id=>navigationItems.find(item=>item.id===id)!).filter(Boolean)
export const remainingMobileNavigation=[competitionNavigation,...navigationItems.filter(item=>!primaryMobileNavigation.some(primary=>primary.id===item.id))]

export function navigationItemForPath(pathname:string){return navigationItems.find(item=>item.exact?pathname===item.path:pathname===item.path||pathname.startsWith(`${item.path}/`))||null}
export function mobileNavigationIndex(pathname:string){const index=primaryMobileNavigation.findIndex(item=>item.exact?pathname===item.path:pathname===item.path||pathname.startsWith(`${item.path}/`));return index>=0?index:4}
