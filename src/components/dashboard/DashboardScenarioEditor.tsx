import {translate as uiText} from '../../i18n'
import {useAppLocale} from '../../i18n/localeStore'
import {T} from '../../i18n'
import { useEffect,useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Modal } from '../ui'
import type { Currency,ExchangeRate,ScenarioInput } from '../../lib/dashboardFinance'

const percent=(value:number)=>String(Math.round(value*10000)/100)
const parseList=(value:string,length:number,fallback:number[])=>{const parsed=value.split(',').map(Number);return parsed.length===length&&parsed.every(Number.isFinite)?parsed:fallback}

const ratePairs:[Currency,Currency][]=[['BRL','USD'],['BRL','EUR'],['USD','BRL'],['EUR','BRL']]
export function DashboardScenarioEditor({scenario,rates,onSave,onSaveRates}:{scenario:ScenarioInput;rates:ExchangeRate[];onSave:(scenario:ScenarioInput)=>Promise<void>;onSaveRates:(rates:ExchangeRate[])=>Promise<void>}){useAppLocale(state=>state.locale);
 const [open,setOpen]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[draft,setDraft]=useState(scenario),[rateDraft,setRateDraft]=useState<Record<string,string>>({})
 useEffect(()=>{if(!open)setDraft(scenario)},[scenario,open])
 useEffect(()=>{if(!open)setRateDraft(Object.fromEntries(rates.map(rate=>[`${rate.baseCurrency}-${rate.quoteCurrency}`,String(rate.rate)])))},[rates,open])
 const patch=(value:Partial<ScenarioInput>)=>setDraft(current=>({...current,...value}))
 const save=async()=>{setSaving(true);setError('');try{await onSave(draft);setOpen(false)}catch{setError('A autorização administrativa não permitiu salvar o cenário.')}finally{setSaving(false)}}
 const saveRates=async()=>{const now=new Date().toISOString(),next=ratePairs.flatMap(([baseCurrency,quoteCurrency])=>{const rate=Number(rateDraft[`${baseCurrency}-${quoteCurrency}`]);return Number.isFinite(rate)&&rate>0?[{baseCurrency,quoteCurrency,rate,source:'Configuração administrativa',observedAt:now}]:[]});if(!next.length){setError('Informe ao menos uma taxa positiva.');return}setSaving(true);setError('');try{await onSaveRates(next)}catch{setError('A autorização administrativa não permitiu salvar as taxas.')}finally{setSaving(false)}}
 return <div className="dashboard-scenario-action"><button className="btn dashboard-scenario-trigger" aria-label={uiText("Abrir editor de planejamento")} onClick={()=>setOpen(true)}><SlidersHorizontal/><T> Editar planejamento</T></button>{open&&<Modal title={uiText("Cenário de planejamento")} onClose={()=>setOpen(false)}><p className="dashboard-scenario-note"><T>Planejamento administrativo isolado. Estes valores não criam transações, compradores, relatórios ou notificações financeiras.</T></p><div className="dashboard-scenario-fields">
  <NumberField label="Faturamento-base de hoje" value={draft.todayRevenueCents/100} step=".01" onChange={value=>patch({todayRevenueCents:Math.round(value*100)})}/>
  <NumberField label="Vendas aprovadas" value={draft.todayApprovedSales} step="1" onChange={value=>patch({todayApprovedSales:Math.round(value)})}/>
  <NumberField label="Ticket médio" value={draft.averageTicketCents/100} step=".01" onChange={value=>patch({averageTicketCents:Math.round(value*100)})}/>
  <PercentField label="Taxa de aprovação" value={draft.approvalRate} onChange={approvalRate=>patch({approvalRate})}/>
  <PercentField label="Taxa de reembolso" value={draft.refundRate} onChange={refundRate=>patch({refundRate})}/>
  <PercentField label="Taxa de chargeback" value={draft.chargebackRate} onChange={chargebackRate=>patch({chargebackRate})}/>
  <PercentField label="Crescimento diário esperado" value={draft.dailyGrowthRate} min={-100} max={1000} onChange={dailyGrowthRate=>patch({dailyGrowthRate})}/>
  <label><span className="label"><T>Moeda-base</T></span><select className="input" value={draft.currency} onChange={event=>patch({currency:event.target.value as Currency})}><option>BRL</option><option>USD</option><option>EUR</option></select></label>
  <NumberField label="Seed determinística" value={draft.seed} step="1" onChange={value=>patch({seed:Math.round(value)})}/>
  <label className="sm:col-span-2"><span className="label"><T>Sazonalidade por dia (domingo a sábado)</T></span><input className="input" value={draft.weekdayFactors.join(',')} onChange={event=>patch({weekdayFactors:parseList(event.target.value,7,draft.weekdayFactors)})}/></label>
  <label className="sm:col-span-2"><span className="label"><T>Distribuição por horário (24 pesos)</T></span><textarea className="input" value={draft.hourlyDistribution.join(',')} onChange={event=>patch({hourlyDistribution:parseList(event.target.value,24,draft.hourlyDistribution)})}/></label>
 </div><section className="dashboard-rate-editor"><h3><T>Taxas de exibição</T></h3><p><T>Cadastre somente taxas verificadas. O horário atual será salvo como timestamp da configuração.</T></p><div className="dashboard-scenario-fields">{ratePairs.map(([base,quote])=><label key={`${base}-${quote}`}><span className="label">{base}<T> para </T>{quote}</span><input className="input" aria-label={`${base} para ${quote}`} type="number" min="0.0000000001" step="0.0000000001" value={rateDraft[`${base}-${quote}`]??''} onChange={event=>setRateDraft(current=>({...current,[`${base}-${quote}`]:event.target.value}))}/></label>)}</div><button className="btn" disabled={saving} onClick={()=>void saveRates()}><T>Salvar taxas</T></button></section>{error&&<p className="onboarding-error">{error}</p>}<div className="flex justify-end gap-2 mt-6"><button className="btn" onClick={()=>setOpen(false)}><T>Cancelar</T></button><button className="btn btn-primary" disabled={saving} onClick={()=>void save()}><T>{saving?'Salvando...':'Salvar planejamento'}</T></button></div></Modal>}</div>
}

function NumberField({label,value,step,onChange}:{label:string;value:number;step:string;onChange:(value:number)=>void}){useAppLocale(state=>state.locale);return <label><span className="label"><T>{label}</T></span><input className="input" type="number" min="0" step={step} value={value} onChange={event=>onChange(Math.max(0,Number(event.target.value)))}/></label>}
function PercentField({label,value,min=0,max=100,onChange}:{label:string;value:number;min?:number;max?:number;onChange:(value:number)=>void}){useAppLocale(state=>state.locale);return <label><span className="label"><T>{label}</T></span><input className="input" type="number" min={min} max={max} step=".01" value={percent(value)} onChange={event=>onChange(Math.min(max,Math.max(min,Number(event.target.value)))/100)}/></label>}
