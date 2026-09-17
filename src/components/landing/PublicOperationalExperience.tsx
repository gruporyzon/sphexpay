import { ArrowUpRight, BarChart3, BatteryFull, Check, Globe2, House, ShieldCheck, Signal, TrendingUp, Wallet, Wifi, Zap } from 'lucide-react'
import { SphexPayLogo } from '../branding/SphexPayLogo'
import { useMobileDemo } from '../../hooks/useMobileDemo'
import '../../landing-device.css'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function PublicOperationalExperience() {
  const demo = useMobileDemo()

  return <figure className="spx-device-stage" id="spx-mobile-preview" aria-label="Prévia demonstrativa da SphexPay no celular" data-scroll-progress data-depth>
    <div className="spx-device-aura" aria-hidden="true" />
    <div className="spx-device-orbit" aria-hidden="true" />
    <div className="spx-device-presentation" data-motion data-motion-kind="mockup">
      <div className="spx-device-shell">
        <div className="spx-device-key spx-device-key-action" aria-hidden="true" />
        <div className="spx-device-key spx-device-key-volume" aria-hidden="true" />
        <div className="spx-device-key spx-device-key-power" aria-hidden="true" />
        <div className="spx-device-screen">
          <div className="spx-device-status" aria-hidden="true"><b>9:41</b><span><Signal /><Wifi /><BatteryFull /></span></div>
          <div className="spx-device-island" aria-hidden="true"><i /></div>
          <div className="spx-device-app">
            <header><SphexPayLogo showName /><span className="spx-device-avatar">SP</span></header>
            <div className="spx-device-greeting"><small>SUA VISÃO DO DIA</small><h3>Bom dia, empreendedor.</h3><span>Sua operação, na palma da mão.</span></div>
            <div className="spx-device-balance"><span>Saldo demonstrativo <Wallet /></span><strong>{money.format(demo.balance)}</strong><small><TrendingUp /> Fluxo acompanhado</small></div>
            <div className="spx-device-chart"><header><span>Visão de vendas</span><small>Últimos 7 dias</small></header><svg viewBox="0 0 260 100" role="img" aria-label="Gráfico ilustrativo de evolução de vendas"><path className="spx-device-chart-area" d="M0 90L0 78C20 78 25 55 44 63S72 75 90 43S120 67 143 35S170 44 190 22S222 36 260 5L260 100L0 100Z"/><path className="spx-device-chart-line" pathLength="1" d="M0 78C20 78 25 55 44 63S72 75 90 43S120 67 143 35S170 44 190 22S222 36 260 5"/></svg><div><span>SEG</span><span>QUA</span><span>SEX</span><span>DOM</span></div></div>
            <div className="spx-device-stats"><div><small>Vendas hoje</small><b>{Math.round(demo.sales)}</b></div><div><small>Meta ilustrativa</small><b>{Math.round(demo.goal)}%</b></div></div>
            <div className="spx-device-event"><i><Check /></i><span><b>{demo.event}</b><small>Exemplo de notificação</small></span><strong>{money.format(demo.amount)}</strong></div>
            <div className="spx-device-dock" aria-hidden="true"><span><House />Início</span><span><BarChart3 />Vendas</span><span><Wallet />Saldo</span><span><Globe2 />Global</span></div>
          </div>
          <div className="spx-device-glass" aria-hidden="true" />
          <div className="spx-device-home" aria-hidden="true" />
        </div>
      </div>
    </div>
    <div className="spx-device-note spx-device-note-sale" data-motion data-motion-delay="3"><i><Zap /></i><span><small>Notificação ilustrativa</small><b>{money.format(demo.amount)} recebidos</b></span><ArrowUpRight /></div>
    <div className="spx-device-note spx-device-note-secure" data-motion data-motion-delay="4"><i><ShieldCheck /></i><span><small>SphexPay no seu ritmo</small><b>Uma experiência conectada</b></span></div>
    <figcaption>Prévia da interface · dados demonstrativos</figcaption>
  </figure>
}
