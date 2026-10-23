import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {useActiveSeller} from '../../hooks/useActiveSeller'
import type {FinancialTransaction} from '../../lib/dashboardFinance'
import {periodBounds} from '../../services/analyticsService'
import {dashboardService} from '../../services/dashboardService'
import {stripeConnectService,type StripeConnectFinance} from '../../services/stripeConnectService'
import {useDemoStore} from '../../store/useDemoStore'
import {useOptionalDashboardData} from '../../providers/DashboardDataProvider'
import {demoFinance} from '../../demo/demoFinance'
import {normalizeTransactions} from '../../lib/dashboardFinance'

// Vendas reais do período selecionado e, opcionalmente, saldo e repasses da Stripe.
export function useFinanceData({stripe=true}:{stripe?:boolean}={}){
 const userId=useActiveSeller().sellerId,period=useDemoStore(state=>state.period)
 const bounds=useMemo(()=>periodBounds(period),[period])
 const [transactions,setTransactions]=useState<FinancialTransaction[]|null>(null),[transactionsError,setTransactionsError]=useState('')
 const [finance,setFinance]=useState<StripeConnectFinance|null>(null),[financeError,setFinanceError]=useState(''),[financeLoading,setFinanceLoading]=useState(stripe)
 // Demo ligada (só o e-mail administrador): as mesmas telas leem a operação da sessão.
 const demo=useOptionalDashboardData(),demoActive=Boolean(demo?.active),demoLedger=useRef(demo?.ledger);demoLedger.current=demo?.ledger
 const loadTransactions=useCallback(()=>{
  if(demoActive){setTransactionsError('');setTransactions(normalizeTransactions((demoLedger.current||[]).filter(item=>{const at=new Date(item.occurredAt);return at>=bounds.start&&at<=bounds.end})));return}
  if(!userId){setTransactions([]);return}
  setTransactions(null);setTransactionsError('')
  dashboardService.loadTransactions(userId,bounds.start,bounds.end).then(setTransactions).catch(()=>{setTransactions([]);setTransactionsError('Não foi possível carregar suas vendas agora.')})
 },[userId,bounds,demoActive])
 const loadFinance=useCallback(()=>{
  if(!stripe)return
  setFinanceLoading(true);setFinanceError('')
  ;(demoActive&&demoLedger.current?Promise.resolve(demoFinance(demoLedger.current)):stripeConnectService.finance()).then(setFinance).catch(error=>{setFinance(null);setFinanceError(error instanceof Error?error.message:'Não foi possível consultar o saldo e os repasses agora.')}).finally(()=>setFinanceLoading(false))
 },[stripe,demoActive])
 useEffect(()=>{loadTransactions()},[loadTransactions])
 useEffect(()=>{loadFinance()},[loadFinance])
 const reload=useCallback(()=>{loadTransactions();loadFinance()},[loadTransactions,loadFinance])
 return{bounds,transactions,transactionsError,finance,financeError,financeLoading,reload}
}
