import { BarChart3,Bell,Check,LockKeyhole,Radio,ShieldCheck,TrendingUp,WalletCards,Zap } from 'lucide-react'
import { SphexPayLogo } from '../branding/SphexPayLogo'

export function PublicPhoneExperience(){
 return <div className="public-phone-stage" aria-label="Interface ilustrativa do aplicativo SphexPay com eventos da operação">
  <div className="phone-aura" aria-hidden="true"/>
  <article className="phone-float phone-float-sale"><i><Check/></i><span><small>Venda aprovada</small><b>R$ 284,90</b></span><em>agora</em></article>
  <article className="phone-float phone-float-pix"><i><Zap/></i><span><small>Pix recebido</small><b>Confirmação instantânea</b></span></article>
  <article className="phone-float phone-float-secure"><ShieldCheck/><span><small>Operação segura</small><b>Monitoramento ativo</b></span></article>
  <div className="public-phone">
   <div className="public-phone-frame">
    <div className="public-phone-island" aria-hidden="true"/>
    <header><SphexPayLogo/><span><small>Olá, Player</small><b>Visão geral</b></span><button aria-label="Notificações ilustrativas"><Bell/></button></header>
    <main>
     <section className="phone-balance"><span>Resultado líquido</span><strong>R$ 21.418,20</strong><small><TrendingUp/> 8,4% neste período</small></section>
     <section className="phone-stats"><article><WalletCards/><span>Vendas</span><b>72</b></article><article><BarChart3/><span>Conversão</span><b>94,7%</b></article></section>
     <section className="phone-chart"><header><span>Performance</span><small>30 dias</small></header><svg viewBox="0 0 260 95" role="img" aria-label="Gráfico ilustrativo de performance"><defs><linearGradient id="phoneChartFill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f15a24" stopOpacity=".3"/><stop offset="1" stopColor="#f15a24" stopOpacity="0"/></linearGradient></defs><path className="fill" d="M0 80C25 72 31 77 50 59s33 1 52-17 35 7 53-10 37 2 55-18 32 3 50-10v91H0Z"/><path className="line" d="M0 80C25 72 31 77 50 59s33 1 52-17 35 7 53-10 37 2 55-18 32 3 50-10"/></svg></section>
     <section className="phone-live"><header><span><Radio/> Vendas ao vivo</span><small>Ver todas</small></header><article><i/><span><b>Pagamento aprovado</b><small>Pix · Brasil</small></span><strong>R$ 284,90</strong></article><article><i/><span><b>Pagamento aprovado</b><small>Cartão · Portugal</small></span><strong>€ 76,00</strong></article></section>
    </main>
    <footer aria-hidden="true"><i className="active"/><i/><i/><i/></footer>
   </div>
  </div>
  <div className="phone-trust-chip"><LockKeyhole/><span><b>Proteção em cada acesso</b><small>Ambiente autenticado</small></span></div>
 </div>
}
