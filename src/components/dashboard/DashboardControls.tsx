import { CalendarDays,Coins } from 'lucide-react'
import type { Currency } from '../../lib/dashboardFinance'
import type { PeriodFilter } from '../../types'

export function DashboardPeriodFilter({period,onChange}:{period:PeriodFilter;onChange:(period:PeriodFilter)=>void}){
 return <div className="dashboard-period-control"><label><CalendarDays/><span>Período</span><select aria-label="Período do gráfico" value={period.preset} onChange={event=>onChange({...period,preset:event.target.value as PeriodFilter['preset']})}><option value="today">Hoje</option><option value="7d">7 dias</option><option value="30d">30 dias</option><option value="custom">Personalizado</option></select></label>{period.preset==='custom'&&<div className="dashboard-custom-dates"><label><span>De</span><input aria-label="Data inicial do gráfico" type="date" max={period.to} value={period.from??''} onChange={event=>onChange({...period,from:event.target.value})}/></label><label><span>Até</span><input aria-label="Data final do gráfico" type="date" min={period.from} value={period.to??''} onChange={event=>onChange({...period,to:event.target.value})}/></label></div>}</div>
}

export function DashboardCurrencySelector({currency,onChange}:{currency:Currency;onChange:(currency:Currency)=>void}){
 return <label className="dashboard-currency-selector"><Coins/><span>Moeda de exibição</span><select aria-label="Moeda de exibição" value={currency} onChange={event=>onChange(event.target.value as Currency)}><option value="BRL">BRL — Real brasileiro</option><option value="USD">USD — Dólar americano</option><option value="EUR">EUR — Euro</option></select></label>
}

export function DashboardModeIndicator({mode}:{mode:'production'|'planning'|'demo'}){
 return <span className={`dashboard-mode-indicator ${mode}`}>{mode==='demo'?'Demonstração':mode==='planning'?'Planejamento':'Produção'}</span>
}
