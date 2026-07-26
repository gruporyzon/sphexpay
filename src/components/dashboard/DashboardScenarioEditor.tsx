import { useEffect,useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Modal } from '../ui'
import type { Currency,ScenarioInput } from '../../lib/dashboardFinance'

const percent=(value:number)=>String(Math.round(value*10000)/100)
const parseList=(value:string,length:number,fallback:number[])=>{const parsed=value.split(',').map(Number);return parsed.length===length&&parsed.every(Number.isFinite)?parsed:fallback}

export function DashboardScenarioEditor({scenario,onSave}:{scenario:ScenarioInput;onSave:(scenario:ScenarioInput)=>Promise<void>}){
 const [open,setOpen]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[draft,setDraft]=useState(scenario)
 useEffect(()=>{if(!open)setDraft(scenario)},[scenario,open])
 const patch=(value:Partial<ScenarioInput>)=>setDraft(current=>({...current,...value}))
 const save=async()=>{setSaving(true);setError('');try{await onSave(draft);setOpen(false)}catch{setError('A autorização administrativa não permitiu salvar o cenário.')}finally{setSaving(false)}}
 return <div className="dashboard-scenario-action"><button className="btn dashboard-scenario-trigger" aria-label="Abrir editor de planejamento" onClick={()=>setOpen(true)}><SlidersHorizontal/> Editar planejamento</button>{open&&<Modal title="Cenário de planejamento" onClose={()=>setOpen(false)}><p className="dashboard-scenario-note">Planejamento administrativo isolado. Estes valores não criam transações, compradores, relatórios ou notificações financeiras.</p><div className="dashboard-scenario-fields">
  <NumberField label="Faturamento-base de hoje" value={draft.todayRevenueCents/100} step=".01" onChange={value=>patch({todayRevenueCents:Math.round(value*100)})}/>
  <NumberField label="Vendas aprovadas" value={draft.todayApprovedSales} step="1" onChange={value=>patch({todayApprovedSales:Math.round(value)})}/>
  <NumberField label="Ticket médio" value={draft.averageTicketCents/100} step=".01" onChange={value=>patch({averageTicketCents:Math.round(value*100)})}/>
  <PercentField label="Taxa de aprovação" value={draft.approvalRate} onChange={approvalRate=>patch({approvalRate})}/>
  <PercentField label="Taxa de reembolso" value={draft.refundRate} onChange={refundRate=>patch({refundRate})}/>
  <PercentField label="Taxa de chargeback" value={draft.chargebackRate} onChange={chargebackRate=>patch({chargebackRate})}/>
  <PercentField label="Crescimento diário esperado" value={draft.dailyGrowthRate} min={-100} max={1000} onChange={dailyGrowthRate=>patch({dailyGrowthRate})}/>
  <label><span className="label">Moeda-base</span><select className="input" value={draft.currency} onChange={event=>patch({currency:event.target.value as Currency})}><option>BRL</option><option>USD</option><option>EUR</option></select></label>
  <NumberField label="Seed determinística" value={draft.seed} step="1" onChange={value=>patch({seed:Math.round(value)})}/>
  <label className="sm:col-span-2"><span className="label">Sazonalidade por dia (domingo a sábado)</span><input className="input" value={draft.weekdayFactors.join(',')} onChange={event=>patch({weekdayFactors:parseList(event.target.value,7,draft.weekdayFactors)})}/></label>
  <label className="sm:col-span-2"><span className="label">Distribuição por horário (24 pesos)</span><textarea className="input" value={draft.hourlyDistribution.join(',')} onChange={event=>patch({hourlyDistribution:parseList(event.target.value,24,draft.hourlyDistribution)})}/></label>
 </div>{error&&<p className="onboarding-error">{error}</p>}<div className="flex justify-end gap-2 mt-6"><button className="btn" onClick={()=>setOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={saving} onClick={()=>void save()}>{saving?'Salvando...':'Salvar planejamento'}</button></div></Modal>}</div>
}

function NumberField({label,value,step,onChange}:{label:string;value:number;step:string;onChange:(value:number)=>void}){return <label><span className="label">{label}</span><input className="input" type="number" min="0" step={step} value={value} onChange={event=>onChange(Math.max(0,Number(event.target.value)))}/></label>}
function PercentField({label,value,min=0,max=100,onChange}:{label:string;value:number;min?:number;max?:number;onChange:(value:number)=>void}){return <label><span className="label">{label}</span><input className="input" type="number" min={min} max={max} step=".01" value={percent(value)} onChange={event=>onChange(Math.min(max,Math.max(min,Number(event.target.value)))/100)}/></label>}
