import {translate as uiText} from '../../i18n'
import {useAppLocale} from '../../i18n/localeStore'
import {T} from '../../i18n'
import { CalendarDays,ChevronDown,Coins } from 'lucide-react'
import type { Currency } from '../../lib/dashboardFinance'
import type { PeriodFilter } from '../../types'

export function DashboardPeriodFilter({period,onChange}:{period:PeriodFilter;onChange:(period:PeriodFilter)=>void}){useAppLocale(state=>state.locale);
 return <div className="dashboard-period-control internal-filter-control"><label className="dashboard-control-field internal-filter-select"><CalendarDays className="internal-filter-icon" aria-hidden="true"/><span><T>Período</T></span><select className="internal-filter-value" aria-label={uiText("Período do gráfico")} value={period.preset} onChange={event=>onChange({...period,preset:event.target.value as PeriodFilter['preset']})}><option value="today"><T>Hoje</T></option><option value="7d"><T>7 dias</T></option><option value="30d"><T>30 dias</T></option><option value="90d"><T>90 dias</T></option><option value="custom"><T>Personalizado</T></option></select><ChevronDown className="dashboard-control-chevron internal-filter-chevron" aria-hidden="true"/></label>{period.preset==='custom'&&<div className="dashboard-custom-dates"><label><span><T>De</T></span><input aria-label={uiText("Data inicial do gráfico")} type="date" max={period.to} value={period.from??''} onChange={event=>onChange({...period,from:event.target.value})}/></label><label><span><T>Até</T></span><input aria-label={uiText("Data final do gráfico")} type="date" min={period.from} value={period.to??''} onChange={event=>onChange({...period,to:event.target.value})}/></label></div>}</div>
}

export function DashboardCurrencySelector({currency,onChange}:{currency:Currency;onChange:(currency:Currency)=>void}){useAppLocale(state=>state.locale);
 return <label className="dashboard-currency-selector dashboard-control-field internal-filter-select"><Coins className="internal-filter-icon" aria-hidden="true"/><span><T>Moeda de exibição</T></span><select className="internal-filter-value" aria-label={uiText("Moeda de exibição")} value={currency} onChange={event=>onChange(event.target.value as Currency)}><option value="BRL" label={uiText("BRL · Real")}><T>BRL — Real brasileiro</T></option><option value="USD" label={uiText("USD · Dólar")}><T>USD — Dólar americano</T></option><option value="EUR" label={uiText("EUR · Euro")}><T>EUR — Euro</T></option></select><ChevronDown className="dashboard-control-chevron internal-filter-chevron" aria-hidden="true"/></label>
}

export function DashboardModeIndicator({mode}:{mode:'production'|'planning'|'demo'}){useAppLocale(state=>state.locale);
 return <span className={`dashboard-mode-indicator ${mode}`}><T>{mode==='demo'?'Modo':mode==='planning'?'Planejamento':'Produção'}</T></span>
}
