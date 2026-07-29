import { useState } from 'react'
import { Award,BarChart3,Bell,CheckCircle2,CreditCard,Globe2,WalletCards } from 'lucide-react'

const views=[
 {id:'overview',label:'Visão geral',title:'Dashboard',copy:'Indicadores, filtros e resultados em uma visão responsiva.',icon:BarChart3},
 {id:'payments',label:'Pagamentos',title:'Transações organizadas',copy:'Status, métodos e valores apresentados com contexto.',icon:CreditCard},
 {id:'live',label:'Vendas ao vivo',title:'Atividade global',copy:'Mapa e feed visual para acompanhar eventos conectados.',icon:Globe2},
 {id:'finance',label:'Financeiro',title:'Visão financeira',copy:'Saldos, períodos e movimentações reunidos com clareza.',icon:WalletCards},
 {id:'awards',label:'Premiações',title:'Jornada SphexPay',copy:'Marcos oficiais e acompanhamento da evolução.',icon:Award}
] as const

export function PublicProductShowcase(){
 const [selected,setSelected]=useState<(typeof views)[number]['id']>(views[0].id),view=views.find(item=>item.id===selected)??views[0],Icon=view.icon
 return <section className="product-showcase" id="plataforma"><header data-reveal><span>PRODUTO REAL, APRESENTAÇÃO SEGURA</span><h2>Tudo o que você precisa para operar e crescer.</h2><p>Explore uma representação leve da interface real, sem carregar o Dashboard, gráficos ou dados privados.</p></header><div className="product-tabs" role="tablist" aria-label="Áreas da plataforma">{views.map(item=><button role="tab" aria-selected={selected===item.id} aria-controls="product-preview" id={`product-tab-${item.id}`} key={item.id} onClick={()=>setSelected(item.id)}>{item.label}</button>)}</div><div className="product-preview" id="product-preview" role="tabpanel" aria-labelledby={`product-tab-${view.id}`} data-reveal><aside><i/><i/><i/><i/><i/></aside><main><header><div><small>SPHEXPAY</small><strong>{view.title}</strong></div><Bell/></header><div className="product-preview-grid"><article className="product-preview-feature"><Icon/><span>{view.label}</span><h3>{view.title}</h3><p>{view.copy}</p><small><CheckCircle2/> Prévia sem dados financeiros</small></article><article className="product-preview-chart"><span>Visão do período</span><div><i/><i/><i/><i/><i/><i/></div><svg viewBox="0 0 500 130" preserveAspectRatio="none" aria-hidden="true"><path d="M0 110 C70 104 80 65 145 80 S230 105 285 52 S385 78 500 18" fill="none" stroke="currentColor" strokeWidth="4"/></svg></article><article className="product-preview-list"><span>Atividade organizada</span>{['Evento confirmado','Atualização disponível','Histórico preservado'].map(item=><p key={item}><i/>{item}<small>Contexto protegido</small></p>)}</article></div></main></div></section>
}
