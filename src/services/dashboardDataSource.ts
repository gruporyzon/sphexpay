import type { Sale } from '../types'

export type DashboardDataMode='production'|'demo'

export function getDashboardDataMode(value=import.meta.env.VITE_DASHBOARD_DATA_MODE):DashboardDataMode{
 return value==='production'?'production':'demo'
}

export function selectDashboardSales(sales:Sale[],mode=getDashboardDataMode()){
 return mode==='demo'?dedupeSalesById(sales):[]
}

export function dedupeSalesById(sales:Sale[]){
 const seen=new Set<string>()
 return sales.filter(sale=>{if(seen.has(sale.id))return false;seen.add(sale.id);return true})
}

export const dashboardRealtimeStatus={
 configured:false,
 source:'Nenhuma tabela ou assinatura Realtime de vendas foi configurada.'
} as const
