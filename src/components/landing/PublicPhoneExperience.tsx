import { BarChart3,Bell,Check,Home,Radio,ShieldCheck,Target,TrendingUp,WalletCards,Zap } from 'lucide-react'
import { SphexPayLogo } from '../branding/SphexPayLogo'
import { useMobileDemo } from '../../hooks/useMobileDemo'

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})

export function PublicPhoneExperience(){
 const demo=useMobileDemo()
 return <div className="spx-phone-stage" id="spx-mobile-preview" aria-label="Interface ilustrativa da experiência mobile SphexPay com eventos da operação" data-scroll-progress>
  <div className="spx-phone-aura" data-motion data-motion-delay="1" aria-hidden="true"/>
  <article className="spx-phone-float spx-phone-float--sale" data-motion data-motion-delay="3" aria-hidden="true"><i><Zap/></i><span><small>Nova venda</small><b>{money.format(demo.amount)}</b></span><em>agora</em></article>
  <article className="spx-phone-float spx-phone-float--approved" data-motion data-motion-delay="4" aria-hidden="true"><i><Check/></i><span><small>Venda aprovada</small><b>R$ 284,90</b></span></article>
  <article className="spx-phone-float spx-phone-float--status" data-motion data-motion-delay="5" aria-hidden="true"><ShieldCheck/><span><small>Status operacional</small><b>Monitoramento ativo</b></span></article>
  <article className="spx-phone-float spx-phone-float--volume" data-motion data-motion-delay="6" aria-hidden="true"><i><TrendingUp/></i><span><small>Volume de vendas</small><b>+{Math.round(demo.sales)} vendas hoje</b></span></article>
  <article className="spx-phone-float spx-phone-float--goal" data-motion data-motion-delay="7" aria-hidden="true"><Target/><span><small>Meta do período</small><b>{Math.round(demo.goal)}% alcançado</b></span></article>
  <div className="spx-phone-device" data-motion data-motion-kind="phone" data-motion-delay="2">
   <div className="spx-phone-screen">
    <div className="spx-phone-island" aria-hidden="true"/>
    <header><SphexPayLogo/><span><small>SPHEXPAY</small><b>Visão geral</b></span><button aria-label="Notificações ilustrativas"><Bell/><i/></button></header>
    <main>
     <section className="spx-phone-balance"><span>Visão consolidada</span><strong>{money.format(demo.balance)}</strong><small><TrendingUp/> Cenário demonstrativo</small></section>
     <section className="spx-phone-stats"><article><WalletCards/><span>Vendas hoje</span><b>{Math.round(demo.sales)}</b></article><article><Target/><span>Meta do período</span><b>{Math.round(demo.goal)}%</b></article></section>
     <section className="spx-phone-chart"><header><span>Performance</span><small>30 dias</small></header><svg viewBox="0 0 260 95" role="img" aria-label="Gráfico ilustrativo de performance"><defs><linearGradient id="spxPhoneChartFill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f15a24" stopOpacity=".3"/><stop offset="1" stopColor="#f15a24" stopOpacity="0"/></linearGradient></defs><path className="fill" d="M0 80C25 72 31 77 50 59s33 1 52-17 35 7 53-10 37 2 55-18 32 3 50-10v91H0Z"/><path className="line" d="M0 80C25 72 31 77 50 59s33 1 52-17 35 7 53-10 37 2 55-18 32 3 50-10"/></svg></section>
     <section className="spx-phone-feed"><header><span><Radio/> Vendas ao vivo</span><small>agora</small></header><article key={demo.revision} className="spx-phone-feed-new"><i/><span><b>{demo.event}</b><small>Pix · confirmado agora</small></span><strong>{money.format(demo.amount)}</strong></article><article><i/><span><b>Venda aprovada</b><small>Cartão · há 2 min</small></span><strong>R$ 284,90</strong></article></section>
    </main>
    <footer className="spx-phone-nav" aria-hidden="true"><i className="active"><Home/></i><i><BarChart3/></i><i><WalletCards/></i><i><Bell/></i></footer>
   </div>
  </div>
 </div>
}
