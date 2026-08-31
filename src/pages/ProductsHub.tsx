import { NavLink,useLocation } from 'react-router-dom'
import { CreditCard,Link2,Package } from 'lucide-react'
import type { ReactNode } from 'react'

const sections=[
 {label:'Produtos',path:'/app/produtos',icon:Package,end:true},
 {label:'Checkout',path:'/app/produtos/checkout',icon:CreditCard,end:false},
 {label:'Links de pagamento',path:'/app/produtos/links',icon:Link2,end:false},
] as const

export default function ProductsHub({children}:{children:ReactNode}){
 const {pathname}=useLocation()
 return <div className="products-hub">
  <nav className="module-tabs" aria-label="Seções de Produtos" role="tablist">
   {sections.map(({label,path,icon:Icon,end})=>{const active=end?pathname===path:pathname.startsWith(path);return <NavLink key={path} to={path} end={end} role="tab" aria-selected={active} className={active?'active':''}><Icon aria-hidden="true"/><span>{label}</span></NavLink>})}
  </nav>
  {children}
 </div>
}
