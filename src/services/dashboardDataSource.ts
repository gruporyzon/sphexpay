import type { Sale } from '../types'

export function selectDashboardSales(_locallyPersistedSales:Sale[]){
 void _locallyPersistedSales
 return [] as Sale[]
}

export function dedupeSalesById(sales:Sale[]){
 const seen=new Set<string>()
 return sales.filter(sale=>{if(seen.has(sale.id))return false;seen.add(sale.id);return true})
}

export const dashboardRealtimeStatus={
 configured:false,
 source:'Nenhuma tabela ou assinatura Realtime de vendas foi configurada.'
} as const
