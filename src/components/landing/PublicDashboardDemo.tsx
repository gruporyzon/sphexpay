import { BarChart3, Check, CircleDollarSign, CreditCard, Percent, ReceiptText, Wallet } from 'lucide-react'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const stats = [
  { label: 'Faturamento', value: 266933.45, icon: CircleDollarSign, positive: '+8,6% no período' },
  { label: 'Resultado líquido', value: 248604.2, icon: Wallet, positive: '+6,4% no período' },
  { label: 'Taxas', value: 18329.25, icon: ReceiptText },
  { label: 'Vendas aprovadas', value: '1.248', icon: Percent },
  { label: 'Ticket médio', value: money.format(214.2), icon: CreditCard },
]
const points = 'M0 152 C32 145 58 154 86 130 S138 137 168 116 S220 126 250 91 S300 103 330 75 S382 88 414 58 S470 65 520 28'

export function PublicDashboardDemo({ className = '' }: { className?: string }) {
  return <div className={`landing-dashboard-preview ${className}`.trim()}>
    <div className="landing-preview-toolbar">
      <div className="landing-preview-title"><span>Dashboard</span><small>Resultados financeiros persistidos e planejamento administrativo isolado.</small></div>
      <div className="landing-preview-filters" aria-label="Filtros demonstrativos"><button type="button">30 dias</button><button type="button">BRL — Real brasileiro</button></div>
    </div>
    <section className="landing-preview-operation" aria-label="Resumo da operação">
      <div className="landing-preview-section-label"><BarChart3 /> RESUMO DA OPERAÇÃO</div>
      <article className="landing-preview-balance"><span>Saldo disponível</span><strong>{money.format(260853.89)}</strong><small><Check /> Atualizado com os dados da conta</small></article>
      <div className="landing-preview-stat-grid">{stats.map(({ label, value, icon: Icon, positive }) => <article key={label}><header><Icon /><span>{label}</span></header><strong>{typeof value === 'number' ? money.format(value) : value}</strong><small>{positive ? <><Check /> {positive}</> : 'Período selecionado'}</small></article>)}</div>
    </section>
    <section className="landing-preview-revenue" aria-label="Faturamento dos últimos 30 dias">
      <header><div><span>FATURAMENTO DOS ÚLTIMOS 30 DIAS</span><strong>{money.format(266933.45)}</strong><small><Check /> 8,6% sobre o período anterior</small></div><BarChart3 /></header>
      <svg viewBox="0 0 520 190" role="img" aria-label="Gráfico demonstrativo de faturamento"><g className="landing-preview-chart-grid"><path d="M0 30H520M0 86H520M0 142H520" /><path d="M52 12V160M156 12V160M260 12V160M364 12V160M468 12V160" /></g><path className="landing-preview-chart-area" d={`${points} L520 160H0Z`} /><path className="landing-preview-chart-line" d={points} /></svg>
    </section>
  </div>
}
