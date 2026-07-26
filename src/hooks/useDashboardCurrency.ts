import { useState } from 'react'
import type { Currency } from '../lib/dashboardFinance'

const key='sphexpay-dashboard-display-currency'
export function useDashboardCurrency(){
 const [currency,setCurrencyState]=useState<Currency>(()=>{const saved=sessionStorage.getItem(key);return saved==='USD'||saved==='EUR'?saved:'BRL'})
 const setCurrency=(value:Currency)=>{sessionStorage.setItem(key,value);setCurrencyState(value)}
 return{currency,setCurrency}
}
