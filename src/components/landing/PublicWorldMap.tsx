import { memo,useEffect,useMemo,useRef,useState } from 'react'
import { geoNaturalEarth1,geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { GeometryCollection,Topology } from 'topojson-specification'
import world from 'world-atlas/countries-110m.json'

const width=960,height=500
const topology=world as unknown as Topology<{countries:GeometryCollection}>
const countries=feature(topology,topology.objects.countries)
const projection=geoNaturalEarth1().fitExtent([[18,18],[width-18,height-18]],countries)
const path=geoPath(projection)
const events=[
 {city:'São Paulo',country:'Brasil',point:[-46.63,-23.55] as [number,number],status:'approved'},
 {city:'Lisboa',country:'Portugal',point:[-9.14,38.72] as [number,number],status:'approved'},
 {city:'Miami',country:'Estados Unidos',point:[-80.19,25.76] as [number,number],status:'processing'},
 {city:'Buenos Aires',country:'Argentina',point:[-58.38,-34.60] as [number,number],status:'regional'}
] as const

export const PublicWorldMap=memo(function PublicWorldMap(){
 const projected=useMemo(()=>events.map(event=>({...event,position:projection(event.point)})).filter(event=>event.position),[])
 const origin=projected[0]?.position??[480,300]
 const root=useRef<HTMLDivElement>(null),[visible,setVisible]=useState(false)
 useEffect(()=>{const element=root.current;if(!element)return;const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{rootMargin:'80px'});observer.observe(element);return()=>observer.disconnect()},[])
 return <div ref={root} className={`public-world-map${visible?' visible':''}`}>
  <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="public-map-title public-map-description">
   <title id="public-map-title">Mapa mundial do módulo Vendas ao Vivo</title>
   <desc id="public-map-description">Exemplo visual com eventos em São Paulo, Lisboa, Miami e Buenos Aires.</desc>
   <defs><linearGradient id="public-map-land" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#35353a"/><stop offset="1" stopColor="#1d1d21"/></linearGradient></defs>
   <path className="public-map-sphere" d={path({type:'Sphere'})??''}/>
   <path className="public-map-countries" d={path(countries)??''}/>
   <g className="public-map-routes">{projected.slice(1).map(({city,position})=>{const [x,y]=position!;return <path key={city} d={`M${origin[0]},${origin[1]} Q${(origin[0]+x)/2},${Math.min(origin[1],y)-45} ${x},${y}`}/>})}</g>
   <g className="public-map-points">{projected.map(({city,country,status,position},index)=>{const [x,y]=position!;return <g key={city} className={`${status} ${index===0?'origin':''}`} tabIndex={0} role="img" aria-label={`${city}, ${country}`}><circle className="halo" cx={x} cy={y} r="11"/><circle cx={x} cy={y} r={index===0?5:4}/><title>{city}, {country}</title></g>})}</g>
  </svg>
 </div>
})
