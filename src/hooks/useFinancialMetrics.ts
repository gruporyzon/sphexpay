import { useMemo } from 'react'
import { metricsFromTransactions,type FinancialTransaction } from '../lib/dashboardFinance'

export function useFinancialMetrics(current:FinancialTransaction[],previous:FinancialTransaction[]){
 return useMemo(()=>{
  const metrics=metricsFromTransactions(current),before=metricsFromTransactions(previous)
  const growthRate=before.approvedRevenueCents?(metrics.approvedRevenueCents-before.approvedRevenueCents)/before.approvedRevenueCents:0
  return{...metrics,growthRate,previousRevenueCents:before.approvedRevenueCents}
 },[current,previous])
}
