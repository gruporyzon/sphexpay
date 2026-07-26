export type RevenueAwardState='unlocked'|'next'|'locked'
export interface RevenueAwardDefinition{
 id:string
 name:string
 target:number
 image:string
 order:number
 description:string
 glow:string
}

export const revenueAwards:RevenueAwardDefinition[]=[
 {id:'10k',name:'Sphex 10K',target:10_000,image:'/premiacoes/sphex-10k.png',order:1,description:'Primeiro marco da jornada SphexPay.',glow:'#c97848'},
 {id:'100k',name:'Sphex 100K',target:100_000,image:'/premiacoes/sphex-100k.png',order:2,description:'Reconhecimento por cem mil reais em faturamento.',glow:'#40b887'},
 {id:'500k',name:'Sphex 500K',target:500_000,image:'/premiacoes/sphex-500k.png',order:3,description:'Marco de alta performance e escala.',glow:'#f2a93b'},
 {id:'1m',name:'Sphex 1M',target:1_000_000,image:'/premiacoes/sphex-1m.png',order:4,description:'Reconhecimento pelo primeiro milhão faturado.',glow:'#8f96a3'},
 {id:'5m',name:'Sphex 5M+',target:5_000_000,image:'/premiacoes/sphex-5m-plus.png',order:5,description:'O nível máximo da jornada de faturamento.',glow:'#e8e8e8'}
]

export function awardState(revenue:number,index:number):RevenueAwardState{
 const award=revenueAwards[index]
 if(revenue>=award.target)return'unlocked'
 const firstLocked=revenueAwards.findIndex(item=>revenue<item.target)
 return index===firstLocked?'next':'locked'
}

export const nextRevenueAward=(revenue:number)=>revenueAwards.find(item=>revenue<item.target)
export const highestRevenueAward=()=>revenueAwards.at(-1)!
