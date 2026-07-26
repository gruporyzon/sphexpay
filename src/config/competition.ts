export type CompetitionStatus='upcoming'|'active'|'ended'|'audit'|'finalized'

export const competitionConfig={
 id:'iphone-17-pro-max-2026',
 slug:'iphone-17-pro-max-2026',
 name:'Competição SphexPay',
 promotionalTitle:'Concorra a um iPhone 17 Pro Max',
 heroTitle:'Rumo ao iPhone 17 Pro Max',
 subtitle:'Alcance a meta, avance no ranking e dispute os principais prêmios da competição',
 bannerDescription:'De 01/09 a 01/10. Alcance R$ 30 mil em vendas elegíveis, avance no ranking e dispute os principais prêmios.',
 startsAt:'2026-09-01T00:00:00-03:00',
 endsAt:'2026-10-01T23:59:59-03:00',
 timezone:'America/Sao_Paulo',
 targetCents:3_000_000,
 image:'/competitions/iphone-17-pro-max.png',
 rules:{
  version:'provisional-1',
  publishedAt:null,
  updatedAt:'2026-07-26T00:00:00-03:00',
  provisional:true,
  eligibility:['approved'],
  exclusions:['cancelled','refunded','chargeback'],
  tieBreakers:['eligible_revenue_desc','target_reached_at_asc','last_eligible_sale_at_asc']
 },
 prizes:[
  {position:1,label:'Prêmio principal',name:'iPhone 17 Pro Max',cashCents:null},
  {position:2,label:'2º lugar',name:'R$ 2.000,00 em dinheiro',cashCents:200_000},
  {position:3,label:'3º lugar',name:'R$ 1.000,00 em dinheiro',cashCents:100_000}
 ]
} as const

export const formatCompetitionMoney=(cents:number,currency='BRL')=>new Intl.NumberFormat('pt-BR',{style:'currency',currency}).format(cents/100)

export function competitionStatus(now=new Date(),persisted?:CompetitionStatus):CompetitionStatus{
 if(persisted==='audit'||persisted==='finalized')return persisted
 const timestamp=now.getTime(),start=new Date(competitionConfig.startsAt).getTime(),end=new Date(competitionConfig.endsAt).getTime()
 if(timestamp<start)return'upcoming'
 if(timestamp<=end)return'active'
 return'ended'
}

export const competitionStatusLabel:Record<CompetitionStatus,string>={
 upcoming:'Em breve',active:'Ativa',ended:'Encerrada',audit:'Em auditoria',finalized:'Finalizada'
}
