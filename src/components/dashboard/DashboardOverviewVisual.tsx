import { BarChart3, Check, CircleDollarSign, Filter, TrendingUp } from 'lucide-react'
import { Card } from '../ui'
import { LiveSalesFeedContent } from './LiveSalesTicker'
import { PremiumStatCard, type PremiumStat } from './PremiumStatCard'
import { RevenueSection } from './RevenueSection'
import type { Currency, ExchangeRate, FinancialPoint, FinancialTransaction } from '../../lib/dashboardFinance'

export interface DashboardOverviewVisualProps {
  stats: PremiumStat[]
  formatMetric: (format: PremiumStat['format']) => (value: number) => string
  balanceCents: number
  balanceLabel?: string
  balanceCaption?: string
  currency: Currency
  chartLabel: string
  chartTotalCents: number
  growth: number
  data: FinancialPoint[]
  loading: boolean
  error: string
  planning: boolean
  feed: FinancialTransaction[]
  rates: ExchangeRate[]
  heading?: string
  eyebrow?: string
  showPeriodFilters?: boolean
  tabs?: Array<{ label: string; active: boolean; onSelect: () => void }>
  activity?: { title: string; description: string; items: Array<{ label: string; detail: string }> }
}

export function DashboardOverviewVisual({
  stats,
  formatMetric,
  balanceCents,
  balanceLabel = 'Saldo disponível',
  balanceCaption = 'Atualizado com os dados da conta',
  currency,
  chartLabel,
  chartTotalCents,
  growth,
  data,
  loading,
  error,
  planning,
  feed,
  rates,
  heading = 'Resultados em contexto',
  eyebrow = 'RESUMO DA OPERAÇÃO',
  showPeriodFilters = false,
  tabs,
  activity,
}: DashboardOverviewVisualProps) {
  return <>
    <div className="dashboard-preview-heading">
      <div><span className="section-eyebrow"><TrendingUp /> {eyebrow}</span>{heading&&<h2>{heading}</h2>}</div>
      {showPeriodFilters && <div className="dashboard-preview-filters"><Filter /><span>Período</span><button className="active">7 dias</button></div>}
    </div>
    <section className="internal-dashboard-layout">
      <aside className="dashboard-preview-summary">
        <div className="dashboard-preview-balance">
          <span>{balanceLabel}</span>
          <strong>{formatMetric('money')(balanceCents)}</strong>
          <small><Check /> {balanceCaption}</small>
        </div>
        <div className="dashboard-preview-metrics">
          {stats.slice(0, 2).map((stat, index) => <PremiumStatCard key={`${stat.label}-${index}`} stat={stat} index={index} refreshing={loading} format={formatMetric(stat.format)} />)}
        </div>
        <div className="dashboard-preview-mini-list">
          {stats.slice(2, 5).map((stat, index) => <div key={`${stat.label}-${index}`}><span>{stat.label}</span><b>{formatMetric(stat.format)(stat.value)}</b></div>)}
        </div>
      </aside>
      <section className="dashboard-preview-chart-panel">
        <header>
          <div><span className="section-eyebrow"><BarChart3 /> {chartLabel}</span><strong>{formatMetric('money')(chartTotalCents)}</strong><small>{growth >= 0 ? '+' : ''}{(growth * 100).toFixed(1).replace('.', ',')}% sobre o período anterior</small></div>
          {tabs && <div className="dashboard-preview-tabs">{tabs.map(tab => <button type="button" key={tab.label} className={tab.active ? 'active' : ''} onClick={tab.onSelect}>{tab.label}</button>)}</div>}
        </header>
        <RevenueSection label={chartLabel} totalCents={chartTotalCents} growth={growth} data={data} currency={currency} loading={loading} error={error} planning={planning} />
      </section>
    </section>
    <section className={`dashboard-preview-lower ${activity ? '' : 'dashboard-preview-lower-single'}`}>
      <LiveSalesFeedContent sales={feed} displayCurrency={currency} rates={rates} planning={planning} />
      {activity && <Card className="dashboard-preview-activity"><div className="section-eyebrow"><CircleDollarSign /> {activity.title}</div><h2>{activity.description}</h2>{activity.items.map(item => <div className="dashboard-preview-event" key={item.label}><i /><span>{item.label}<small>{item.detail}</small></span></div>)}</Card>}
    </section>
  </>
}
