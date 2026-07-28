import { memo,useMemo,useState } from 'react'
import { geoGraticule10,geoNaturalEarth1,geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { GeometryCollection,Topology } from 'topojson-specification'
import world from 'world-atlas/countries-110m.json'
import type { GlobalSaleEvent } from '../../lib/liveSalesMap'

const width=960,height=500
const topology=world as unknown as Topology<{countries:GeometryCollection<{name:string}>}>
const countries=feature(topology,topology.objects.countries)
const projection=geoNaturalEarth1().fitExtent([[18,18],[width-18,height-18]],countries)
const path=geoPath(projection)
const origin=projection([-46.6333,-23.5505])??[width/2,height/2]

function routePath(destination:[number,number]){
 const point=projection(destination)
 if(!point)return''
 const [x,y]=point,[ox,oy]=origin,curve=Math.max(30,Math.abs(x-ox)*.16)
 return`M${ox},${oy} Q${(ox+x)/2},${Math.min(oy,y)-curve} ${x},${y}`
}

export const WorldSalesMap=memo(function WorldSalesMap({events}:{events:GlobalSaleEvent[]}){
 const [hovered,setHovered]=useState<GlobalSaleEvent|null>(null)
 const recent=events.slice(0,7),active=recent[0],activeIds=useMemo(()=>new Set(recent.map(event=>event.country.id)),[recent])
 return <div className="live-world-map" aria-label="Mapa mundial de vendas ao vivo">
  <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="world-map-title">
   <title id="world-map-title">Destinos globais das vendas mais recentes</title>
   <defs>
    <linearGradient id="live-world-land" x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--live-map-land-hi)"/><stop offset="1" stopColor="var(--live-map-land)"/></linearGradient>
    <filter id="live-world-glow" x="-200%" y="-200%" width="400%" height="400%"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
   </defs>
   <path className="live-world-sphere" d={path({type:'Sphere'})??''}/>
   <path className="live-world-graticule" d={path(geoGraticule10())??''}/>
   <g className="live-world-countries">{countries.features.map(country=><path key={String(country.id)} className={activeIds.has(String(country.id).padStart(3,'0'))?'reached':''} d={path(country)??''}><title>{country.properties?.name}</title></path>)}</g>
   <g className="live-world-routes">{recent.map((event,index)=><path key={event.transaction.transactionId} className={index===0?'active':''} d={routePath(event.country.coordinates)} style={{animationDelay:`-${index*.24}s`}}/>)}</g>
   <g className="live-world-origin"><circle cx={origin[0]} cy={origin[1]} r="4"/><circle className="wave" cx={origin[0]} cy={origin[1]} r="7"/></g>
   <g className="live-world-points">{recent.map((event,index)=>{const point=projection(event.country.coordinates);if(!point)return null;return <g key={event.transaction.transactionId} className={index===0?'active':''} onMouseEnter={()=>setHovered(event)} onMouseLeave={()=>setHovered(null)} onFocus={()=>setHovered(event)} onBlur={()=>setHovered(null)} tabIndex={0} role="button" aria-label={`${event.activity} em ${event.country.name}`}><circle className="wave" cx={point[0]} cy={point[1]} r="9"/><circle cx={point[0]} cy={point[1]} r={index===0?5:3.5}/></g>})}</g>
  </svg>
  {hovered&&<div className="live-world-tooltip" style={{left:`${((projection(hovered.country.coordinates)?.[0]??0)/width)*100}%`,top:`${((projection(hovered.country.coordinates)?.[1]??0)/height)*100}%`}}><span>{hovered.country.flag} {hovered.country.name}</span><strong>{hovered.activity}</strong></div>}
  <div className="live-world-map-legend"><span><i/> Origem</span><span><i/> Destino recente</span></div>
  {!events.length&&<div className="live-world-map-empty"><strong>Aguardando atividade global</strong><span>Os novos destinos aparecerão aqui em tempo real.</span></div>}
  {active&&<div className="live-world-now" aria-live="polite"><i/><span>Último destino</span><strong>{active.country.flag} {active.country.name}</strong></div>}
 </div>
})
