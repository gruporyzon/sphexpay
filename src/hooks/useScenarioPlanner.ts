import { useEffect,useState } from 'react'
import { dashboardService } from '../services/dashboardService'
import { normalizeFinancialMetrics,type ScenarioInput } from '../lib/dashboardFinance'

export const defaultScenario:ScenarioInput={todayRevenueCents:0,todayApprovedSales:0,averageTicketCents:0,approvalRate:.9,refundRate:0,chargebackRate:0,dailyGrowthRate:0,weekdayFactors:[.75,1,1,1,1,1,.8],hourlyDistribution:[0,0,0,0,0,0,.01,.02,.04,.06,.08,.09,.1,.09,.08,.08,.08,.07,.06,.05,.04,.03,.01,.01],seed:1,currency:'BRL'}

export function useScenarioPlanner(userId:string|undefined,enabled:boolean){
 const [scenario,setScenario]=useState<ScenarioInput>(defaultScenario),[loading,setLoading]=useState(enabled),[error,setError]=useState('')
 useEffect(()=>{if(!enabled||!userId){setLoading(false);return}let active=true;dashboardService.loadScenario(userId).then(value=>{if(active&&value)setScenario(normalizeFinancialMetrics(value))}).catch(()=>{if(active)setError('Não foi possível carregar o planejamento.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[userId,enabled])
 const save=async(next:ScenarioInput)=>{if(!userId||!enabled)throw new Error('SCENARIO_SAVE_FORBIDDEN');const normalized=normalizeFinancialMetrics(next);await dashboardService.saveScenario(userId,normalized);setScenario(normalized)}
 return{scenario,setScenario,save,loading,error}
}
