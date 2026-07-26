import { useEffect,useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Modal } from '../ui'
import type { Currency,ExchangeRate,ScenarioInput } from '../../lib/dashboardFinance'

const percent=(value:number)=>String(Math.round(value*10000)/100)
const parseList=(value:string,length:number,fallback:number[])=>{const parsed=value.split(',').map(Number);return parsed.length===length&&parsed.every(Number.isFinite)?parsed:fallback}

const ratePairs:[Currency,Currency][]=[['BRL','USD'],['BRL','EUR'],['USD','BRL'],['EUR','BRL']]
export function DashboardScenarioEditor({scenario,rates,onSave,onSaveRates}:{scenario:ScenarioInput;rates:ExchangeRate[];onSave:(scenario:ScenarioInput)=>Promise<void>;onSaveRates:(rates:ExchangeRate[])=>Promise<void>}){
 const [open,setOpen]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[draft,setDraft]=useState(scenario),[rateDraft,setRateDraft]=useState<Record<string,string>>({})
 useEffect(()=>{if(!open)setDraft(scenario)},[scenario,open])
 useEffect(()=>{if(!open)setRateDraft(Object.fromEntries(rates.map(rate=>[`${rate.baseCurrency}-${rate.quoteCurrency}`,String(rate.rate)])))},[rates,open])
 const patch=(value:Partial<ScenarioInput>)=>setDraft(current=>({...current,...value}))
 const save=async()=>{setSaving(true);setError('');try{await onSave(draft);setOpen(false)}catch{setError('A autorização administrativa não permitiu salvar o cenário.')}finally{setSaving(false)}}
 const saveRates=async()=>{const now=new Date().toISOString(),next=ratePairs.flatMap(([baseCurrency,quoteCurrency])=>{const rate=Number(rateDraft[`${baseCurrency}-${quoteCurrency}`]);return Number.isFinite(rate)&&rate>0?[{baseCurrency,quoteCurrency,rate,source:'Configuração administrativa',observedAt:now}]:[]});if(!next.length){setError('Informe ao menos uma taxa positiva.');return}setSaving(true);setError('');try{await onSaveRates(next)}catch{setError('A autorização administrativa não permitiu salvar as taxas.')}finally{setSaving(false)}}
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
 </div><section className="dashboard-rate-editor"><h3>Taxas de exibição</h3><p>Cadastre somente taxas verificadas. O horário atual será salvo como timestamp da configuração.</p><div className="dashboard-scenario-fields">{ratePairs.map(([base,quote])=><label key={`${base}-${quote}`}><span className="label">{base} para {quote}</span><input className="input" aria-label={`${base} para ${quote}`} type="number" min="0.0000000001" step="0.0000000001" value={rateDraft[`${base}-${quote}`]??''} onChange={event=>setRateDraft(current=>({...current,[`${base}-${quote}`]:event.target.value}))}/></label>)}</div><button className="btn" disabled={saving} onClick={()=>void saveRates()}>Salvar taxas</button></section>{error&&<p className="onboarding-error">{error}</p>}<div className="flex justify-end gap-2 mt-6"><button className="btn" onClick={()=>setOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={saving} onClick={()=>void save()}>{saving?'Salvando...':'Salvar planejamento'}</button></div></Modal>}</div>
}

function NumberField({label,value,step,onChange}:{label:string;value:number;step:string;onChange:(value:number)=>void}){return <label><span className="label">{label}</span><input className="input" type="number" min="0" step={step} value={value} onChange={event=>onChange(Math.max(0,Number(event.target.value)))}/></label>}
function PercentField({label,value,min=0,max=100,onChange}:{label:string;value:number;min?:number;max?:number;onChange:(value:number)=>void}){return <label><span className="label">{label}</span><input className="input" type="number" min={min} max={max} step=".01" value={percent(value)} onChange={event=>onChange(Math.min(max,Math.max(min,Number(event.target.value)))/100)}/></label>}
