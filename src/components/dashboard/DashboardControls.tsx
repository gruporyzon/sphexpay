import {translate as uiText} from '../../i18n'
import {useAppLocale} from '../../i18n/localeStore'
import {T} from '../../i18n'
import { CalendarDays,ChevronDown,Coins,Settings2 } from 'lucide-react'
import type { Currency } from '../../lib/dashboardFinance'
import type { PeriodFilter } from '../../types'

export function DashboardPeriodFilter({period,onChange,compact=true}:{period:PeriodFilter;onChange:(period:PeriodFilter)=>void;compact?:boolean}){useAppLocale(state=>state.locale);
 if(compact)return <div className="workspace-period-control"><div className="workspace-segments" role="group" aria-label={uiText('Período do gráfico')}>{(['7d','30d','90d'] as const).map(preset=><button type="button" key={preset} aria-pressed={period.preset===preset} onClick={()=>onChange({...period,preset})}>{preset.slice(0,-1)}<T> dias</T></button>)}</div><details className="reference-custom-period"><summary aria-label={uiText('Mais filtros')}><Settings2/>{!['7d','30d','90d'].includes(period.preset)&&<span><T>{period.preset==='today'?'Hoje':'Personalizado'}</T></span>}</summary><div><DashboardPeriodFilter period={period} onChange={onChange} compact={false}/></div></details></div>
 return <div className="dashboard-period-control internal-filter-control"><label className="dashboard-control-field internal-filter-select"><CalendarDays className="internal-filter-icon" aria-hidden="true"/><span><T>Período</T></span><select className="internal-filter-value" aria-label={uiText("Período do gráfico")} value={period.preset} onChange={event=>onChange({...period,preset:event.target.value as PeriodFilter['preset']})}><option value="today"><T>Hoje</T></option><option value="7d"><T>7 dias</T></option><option value="30d"><T>30 dias</T></option><option value="90d"><T>90 dias</T></option><option value="custom"><T>Personalizado</T></option></select><ChevronDown className="dashboard-control-chevron internal-filter-chevron" aria-hidden="true"/></label>{period.preset==='custom'&&<div className="dashboard-custom-dates"><label><span><T>De</T></span><input aria-label={uiText("Data inicial do gráfico")} type="date" max={period.to} value={period.from??''} onChange={event=>onChange({...period,from:event.target.value})}/></label><label><span><T>Até</T></span><input aria-label={uiText("Data final do gráfico")} type="date" min={period.from} value={period.to??''} onChange={event=>onChange({...period,to:event.target.value})}/></label></div>}</div>
}

export function DashboardCurrencySelector({currency,onChange,compact=true}:{currency:Currency;onChange:(currency:Currency)=>void;compact?:boolean}){useAppLocale(state=>state.locale);
 if(compact)return <div className="workspace-segments" role="group" aria-label={uiText('Moeda de exibição')}>{([['BRL','R$ BRL'],['EUR','€ EUR'],['USD','US$ USD']] as const).map(([value,label])=><button type="button" key={value} aria-pressed={currency===value} onClick={()=>onChange(value)}>{label}</button>)}</div>
 return <label className="dashboard-currency-selector dashboard-control-field internal-filter-select"><Coins className="internal-filter-icon" aria-hidden="true"/><span><T>Moeda de exibição</T></span><select className="internal-filter-value" aria-label={uiText("Moeda de exibição")} value={currency} onChange={event=>onChange(event.target.value as Currency)}><option value="BRL" label={uiText("BRL · Real")}><T>BRL — Real brasileiro</T></option><option value="USD" label={uiText("USD · Dólar")}><T>USD — Dólar americano</T></option><option value="EUR" label={uiText("EUR · Euro")}><T>EUR — Euro</T></option></select><ChevronDown className="dashboard-control-chevron internal-filter-chevron" aria-hidden="true"/></label>
}

export function DashboardModeIndicator({mode}:{mode:'production'|'planning'|'demo'}){useAppLocale(state=>state.locale);
 return <span className={`dashboard-mode-indicator ${mode}`}><T>{mode==='demo'?'Modo':mode==='planning'?'Planejamento':'Produção'}</T></span>
}
