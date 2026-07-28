import { useMemo,useState } from 'react'
import { Card,Empty,PageTitle,SearchBox } from '../components/ui'
import { useDashboardData } from '../providers/DashboardDataProvider'
import { EditableCustomers } from './EditableRecords'
import { formatCents } from '../lib/currencyFormat'
import { useDashboardCurrency } from '../hooks/useDashboardCurrency'
import { convertDemoCents } from '../demo/demoSimulationEngine'

export default function DemoAwareCustomers(){
 const demo=useDashboardData()
 if(!demo.active)return <EditableCustomers/>
 return <DemoCustomerList/>
}
function DemoCustomerList(){
 const {customers}=useDashboardData(),{currency}=useDashboardCurrency(),[query,setQuery]=useState('')
 const rows=useMemo(()=>customers.filter(item=>`${item.name} ${item.email} ${item.lastProduct}`.toLowerCase().includes(query.toLowerCase())),[customers,query])
 return <div className="page-enter"><PageTitle title="Clientes" subtitle="Perfis derivados das vendas recentes."/><Card><div className="p-4 max-w-md"><SearchBox value={query} onChange={setQuery} placeholder="Nome, e-mail reservado ou produto..."/></div><div className="table-wrap"><table className="table"><thead><tr><th>Cliente</th><th>Compras</th><th>Total acumulado</th><th>Último pedido</th><th>Produto</th></tr></thead><tbody>{rows.map(item=>{const total=Object.entries(item.totalCentsByCurrency).reduce((sum,[source,value])=>sum+convertDemoCents(value??0,source as 'BRL'|'USD'|'EUR',currency),0);return <tr key={item.id}><td><b>{item.name}</b><p className="muted text-[11px]">{item.email}</p></td><td>{item.purchases}</td><td><b>{formatCents(total,currency)}</b></td><td>{new Date(item.lastOrderAt).toLocaleString('pt-BR')}</td><td>{item.lastProduct}</td></tr>})}</tbody></table>{!rows.length&&<Empty/>}</div></Card></div>
}
