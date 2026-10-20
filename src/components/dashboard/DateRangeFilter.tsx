import {translate as uiText} from '../../i18n'
import {useAppLocale} from '../../i18n/localeStore'
import {T} from '../../i18n'
import { CalendarDays } from 'lucide-react'
import { periodOptions } from '../../services/analyticsService'
import { useDemoStore } from '../../store/useDemoStore'

export function DateRangeFilter(){useAppLocale(state=>state.locale);const period=useDemoStore(s=>s.period),setPeriod=useDemoStore(s=>s.setPeriod);return <div className="chart-date-filter"><label><CalendarDays/><span className="sr-only"><T>Período do gráfico</T></span><select aria-label={uiText("Período do gráfico")} value={period.preset} onChange={event=>setPeriod({...period,preset:event.target.value as typeof period.preset})}>{periodOptions.map(([value,label])=><option value={value} key={value}><T>{label}</T></option>)}</select></label>{period.preset==='custom'&&<div className="chart-custom-range"><label><span><T>Data inicial</T></span><input aria-label={uiText("Data inicial do gráfico")} type="date" max={period.to} value={period.from??''} onChange={event=>setPeriod({...period,from:event.target.value})}/></label><i/><label><span><T>Data final</T></span><input aria-label={uiText("Data final do gráfico")} type="date" min={period.from} value={period.to??''} onChange={event=>setPeriod({...period,to:event.target.value})}/></label></div>}</div>}
