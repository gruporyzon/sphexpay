import { lazy,Suspense } from 'react'
import { Clock3,CreditCard,MapPin,Radio,Tally4 } from 'lucide-react'

const PublicWorldMap=lazy(()=>import('./PublicWorldMap').then(module=>({default:module.PublicWorldMap})))

const sales=[
 ['Brasil','R$ 284,90','Pix','Agora'],
 ['Portugal','€ 76,00','Cartão','12:42'],
 ['Estados Unidos','US$ 119,00','Cartão','12:40']
] as const

export function PublicLiveSalesPreview({compact=false}:{compact?:boolean}){
 return <div className={`public-live-console${compact?' compact':''}`}>
  <header><div><span><Radio/> Vendas ao Vivo</span><strong>Atividade da operação</strong></div><small><i/> Atualizando</small></header>
  <div className="public-live-metrics"><article><MapPin/><span>Regiões ativas</span><strong>4</strong></article><article><Tally4/><span>Eventos recentes</span><strong>12</strong></article><article><Clock3/><span>Última atividade</span><strong>Agora</strong></article></div>
  <div className="public-live-body"><div className="public-live-map-wrap"><Suspense fallback={<div className="public-map-loading" aria-label="Carregando mapa"/>}><PublicWorldMap/></Suspense><span className="public-map-caption">Alcance regional da operação</span></div><div className="public-live-stream"><header><span>Eventos recentes</span><small>Hoje</small></header>{sales.slice(0,compact?2:3).map(([country,value,method,time],index)=><article key={country}><i className={index===1?'processing':''}/><span><b>{country}</b><small><CreditCard/> {method}</small></span><strong>{value}<small>{time}</small></strong></article>)}</div></div>
  <footer><span><i/> Evento aprovado</span><span><i/> Em processamento</span><span><i/> Atualização regional</span></footer>
 </div>
}
