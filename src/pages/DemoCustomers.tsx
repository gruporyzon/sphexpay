import {translate as uiText} from '../i18n'
import {useAppLocale} from '../i18n/localeStore'
import {T} from '../i18n'
import { useMemo,useState } from 'react'
import { Card,Empty,SearchBox } from '../components/ui'
import { useDashboardData } from '../providers/DashboardDataProvider'
import { RealCustomers } from '../features/customers/RealCustomers'
import { formatCents } from '../lib/currencyFormat'
import { useDashboardCurrency } from '../hooks/useDashboardCurrency'
import { convertDemoCents } from '../demo/demoSimulationEngine'

export default function DemoAwareCustomers(){useAppLocale(state=>state.locale);
 const demo=useDashboardData()
 if(!demo.active)return <RealCustomers/>
 return <DemoCustomerList/>
}
function DemoCustomerList(){useAppLocale(state=>state.locale);
 const {customers}=useDashboardData(),{currency}=useDashboardCurrency(),[query,setQuery]=useState('')
 const rows=useMemo(()=>customers.filter(item=>`${item.name} ${item.countryName} ${item.cityName} ${item.lastProduct}`.toLowerCase().includes(query.toLowerCase())),[customers,query])
 return <section className="customers-page" aria-label={uiText("Clientes")}><header className="reports-section-heading"><h2><T>Clientes</T></h2><p><T>Perfis derivados das vendas recentes.</T></p></header><Card><div className="p-4 max-w-md"><SearchBox value={query} onChange={setQuery} placeholder={uiText("Nome, país, cidade ou produto...")}/></div><div className="table-wrap"><table className="table"><thead><tr><th><T>Cliente</T></th><th><T>Localização</T></th><th><T>Compras</T></th><th><T>Total acumulado</T></th><th><T>Último pedido</T></th><th><T>Produto</T></th></tr></thead><tbody>{rows.map(item=>{const total=Object.entries(item.totalCentsByCurrency).reduce((sum,[source,value])=>sum+convertDemoCents(value??0,source as 'BRL'|'USD'|'EUR',currency),0);return <tr key={item.id}><td><b>{item.name}</b><p className="muted text-[11px]">{item.email}</p></td><td>{item.cityName}<p className="muted text-[11px]">{item.countryName}</p></td><td>{item.purchases}</td><td><b>{formatCents(total,currency)}</b></td><td>{new Date(item.lastOrderAt).toLocaleString('pt-BR')}</td><td>{item.lastProduct}</td></tr>})}</tbody></table>{!rows.length&&<Empty/>}</div></Card></section>
}
