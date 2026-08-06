import { useLocation,useNavigate } from 'react-router-dom'

const previews=[
 ['dashboard-preview','Dashboard'],
 ['live-sales-preview','Vendas ao vivo'],
 ['transactions-preview','Transações'],
 ['products-preview','Produtos'],
 ['customers-preview','Clientes'],
 ['finance-preview','Financeiro'],
 ['notifications-preview','Notificações'],
 ['settings-preview','Configurações'],
] as const

export function DevPreviewNavigator(){
 const navigate=useNavigate(),location=useLocation(),current=location.pathname.split('/').pop()||''
 if(!import.meta.env.DEV)return null
 return <label className="dev-preview-navigator"><span>Navegar pelos previews</span><select aria-label="Navegar pelos previews" value={current} onChange={event=>navigate(`/dev/${event.target.value}`)}>{previews.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
}
