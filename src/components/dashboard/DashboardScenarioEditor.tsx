import { useEffect,useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Modal } from '../ui'
import { money } from '../../lib/utils'
import type { DashboardKpis,Sale } from '../../types'
import type { DashboardKpiChanges } from '../../lib/dashboardIntelligence'

type EditableKey='revenue'|'sales'|'ticket'|'goal'
const fields:[EditableKey,string,string][]=[
 ['revenue','Faturamento','0.01'],['sales','Quantidade de vendas','1'],['ticket','Ticket médio','0.01'],['goal','Meta do período','0.01']
]

export function DashboardScenarioEditor({kpis,currency,onSave}:{kpis:DashboardKpis;currency:Sale['currency'];onSave:(changes:DashboardKpiChanges)=>void}){
 const [open,setOpen]=useState(false),[draft,setDraft]=useState<Record<EditableKey,string>>({revenue:String(kpis.revenue),sales:String(kpis.sales),ticket:String(kpis.ticket),goal:String(kpis.goal)})
 useEffect(()=>{if(!open)setDraft({revenue:String(kpis.revenue),sales:String(kpis.sales),ticket:String(kpis.ticket),goal:String(kpis.goal)})},[kpis,open])
 const save=()=>{const changes:DashboardKpiChanges={};for(const [key] of fields){const value=Number(draft[key]);if(Number.isFinite(value)&&value>=0&&value!==kpis[key])changes[key]=value}onSave(changes);setOpen(false)}
 const invalid=fields.some(([key])=>!draft[key]||!Number.isFinite(Number(draft[key]))||Number(draft[key])<0)
 return <div className="dashboard-scenario-action"><button className="btn dashboard-scenario-trigger" aria-label="Abrir editor administrativo" onClick={()=>setOpen(true)}><SlidersHorizontal/> Editor administrativo</button>{open&&<Modal title="Ajustar visualização administrativa" onClose={()=>setOpen(false)}><p className="dashboard-scenario-note">Os valores editáveis são exclusivamente demonstrativos, permanecem neste dispositivo e não criam vendas ou movimentações financeiras.</p><div className="dashboard-scenario-fields">{fields.map(([key,label,step])=><label key={key}><span className="label">{label}</span><input className="input" type="number" min="0" step={step} value={draft[key]} onChange={event=>setDraft({...draft,[key]:event.target.value})}/><small>{key==='revenue'||key==='ticket'||key==='goal'?money(Number(draft[key])||0,currency):`${Math.round(Number(draft[key])||0).toLocaleString('pt-BR')} vendas`}</small></label>)}</div><div className="flex justify-end gap-2 mt-6"><button className="btn" onClick={()=>setOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={invalid} onClick={save}>Aplicar visualização</button></div></Modal>}</div>
}
