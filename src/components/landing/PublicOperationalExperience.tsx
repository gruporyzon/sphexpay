import { Check, Globe2, Radio, ShieldCheck, TrendingUp, Zap } from 'lucide-react'
import { SphexPayLogo } from '../branding/SphexPayLogo'
import { useMobileDemo } from '../../hooks/useMobileDemo'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function PublicOperationalExperience() {
  const demo = useMobileDemo()

  return <div className="spx-operations-visual" id="spx-mobile-preview" aria-label="Visão ilustrativa da inteligência operacional global SphexPay" data-scroll-progress>
    <div className="spx-operations-orbit spx-operations-orbit--outer" aria-hidden="true" />
    <div className="spx-operations-orbit spx-operations-orbit--inner" aria-hidden="true" />
    <svg className="spx-operations-connectors" viewBox="0 0 620 620" aria-hidden="true"><path d="M130 140L310 285M490 155L350 285M112 435L276 338M508 442L352 342" /><circle cx="130" cy="140" r="3" /><circle cx="490" cy="155" r="3" /><circle cx="112" cy="435" r="3" /><circle cx="508" cy="442" r="3" /></svg>
    <article className="spx-operations-card spx-operations-card--sale" data-motion data-motion-delay="2"><i><Zap /></i><span><small>Nova venda</small><b>{money.format(demo.amount)}</b></span><em>agora</em></article>
    <article className="spx-operations-card spx-operations-card--global" data-motion data-motion-delay="3"><i><Globe2 /></i><span><small>Operação global</small><b>24 mercados ativos</b></span></article>
    <article className="spx-operations-card spx-operations-card--status" data-motion data-motion-delay="4"><i><ShieldCheck /></i><span><small>Monitoramento ativo</small><b>Todos os sistemas online</b></span><strong /></article>
    <article className="spx-operations-card spx-operations-card--volume" data-motion data-motion-delay="5"><i><TrendingUp /></i><span><small>Volume em tempo real</small><b>+{Math.round(demo.sales)} vendas hoje</b></span></article>
    <div className="spx-operations-core" data-motion data-motion-delay="1"><div className="spx-operations-core-mark"><SphexPayLogo /></div><div className="spx-operations-core-copy"><small><Radio /> INTELIGÊNCIA OPERACIONAL</small><strong>Fluxo acompanhado</strong><span>Dados conectados em um só lugar.</span></div><div className="spx-operations-core-footer"><span><Check /> gateway pronto</span><b>{Math.round(demo.goal)}% de eficiência</b></div></div>
  </div>
}
