import {useCallback,useEffect,useMemo,useState} from 'react'
import {useActiveSeller} from '../../hooks/useActiveSeller'
import type {FinancialTransaction} from '../../lib/dashboardFinance'
import {periodBounds} from '../../services/analyticsService'
import {dashboardService} from '../../services/dashboardService'
import {stripeConnectService,type StripeConnectFinance} from '../../services/stripeConnectService'
import {useDemoStore} from '../../store/useDemoStore'

// Vendas reais do período selecionado e, opcionalmente, saldo e repasses da Stripe.
export function useFinanceData({stripe=true}:{stripe?:boolean}={}){
 const userId=useActiveSeller().sellerId,period=useDemoStore(state=>state.period)
 const bounds=useMemo(()=>periodBounds(period),[period])
 const [transactions,setTransactions]=useState<FinancialTransaction[]|null>(null),[transactionsError,setTransactionsError]=useState('')
 const [finance,setFinance]=useState<StripeConnectFinance|null>(null),[financeError,setFinanceError]=useState(''),[financeLoading,setFinanceLoading]=useState(stripe)
 const loadTransactions=useCallback(()=>{
  if(!userId){setTransactions([]);return}
  setTransactions(null);setTransactionsError('')
  dashboardService.loadTransactions(userId,bounds.start,bounds.end).then(setTransactions).catch(()=>{setTransactions([]);setTransactionsError('Não foi possível carregar suas vendas agora.')})
 },[userId,bounds])
 const loadFinance=useCallback(()=>{
  if(!stripe)return
  setFinanceLoading(true);setFinanceError('')
  stripeConnectService.finance().then(setFinance).catch(error=>{setFinance(null);setFinanceError(error instanceof Error?error.message:'Não foi possível consultar o saldo e os repasses agora.')}).finally(()=>setFinanceLoading(false))
 },[stripe])
 useEffect(()=>{loadTransactions()},[loadTransactions])
 useEffect(()=>{loadFinance()},[loadFinance])
 const reload=useCallback(()=>{loadTransactions();loadFinance()},[loadTransactions,loadFinance])
 return{bounds,transactions,transactionsError,finance,financeError,financeLoading,reload}
}
