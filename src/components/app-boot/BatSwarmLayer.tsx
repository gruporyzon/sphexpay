import type { CSSProperties } from 'react'

type BatDepth='back'|'middle'|'front'
type BatFlight={depth:BatDepth;dx:number;dy:number;mx:number;my:number;size:number;delay:number;duration:number;rotate:number}
type FlightStyle=CSSProperties&Record<`--${string}`,string>

const flights:BatFlight[]=[
 {depth:'back',dx:-42,dy:-35,mx:-15,my:-18,size:9,delay:270,duration:720,rotate:-24},
 {depth:'back',dx:36,dy:-40,mx:13,my:-17,size:8,delay:310,duration:760,rotate:21},
 {depth:'back',dx:-34,dy:-22,mx:-9,my:-12,size:7,delay:350,duration:680,rotate:-14},
 {depth:'back',dx:45,dy:-18,mx:18,my:-8,size:10,delay:390,duration:710,rotate:28},
 {depth:'back',dx:-23,dy:-43,mx:-6,my:-20,size:8,delay:430,duration:740,rotate:-9},
 {depth:'back',dx:24,dy:-46,mx:7,my:-22,size:7,delay:470,duration:780,rotate:12},
 {depth:'back',dx:-47,dy:-8,mx:-20,my:-4,size:9,delay:510,duration:680,rotate:-30},
 {depth:'back',dx:48,dy:-3,mx:20,my:-6,size:8,delay:550,duration:700,rotate:34},
 {depth:'back',dx:5,dy:-50,mx:-2,my:-23,size:7,delay:590,duration:720,rotate:5},
 {depth:'middle',dx:-48,dy:-30,mx:-17,my:-11,size:14,delay:290,duration:650,rotate:-28},
 {depth:'middle',dx:43,dy:-32,mx:16,my:-13,size:13,delay:325,duration:690,rotate:24},
 {depth:'middle',dx:-38,dy:-46,mx:-11,my:-20,size:12,delay:360,duration:720,rotate:-19},
 {depth:'middle',dx:33,dy:-48,mx:9,my:-21,size:15,delay:395,duration:740,rotate:17},
 {depth:'middle',dx:-51,dy:-14,mx:-23,my:-8,size:13,delay:430,duration:630,rotate:-36},
 {depth:'middle',dx:52,dy:-13,mx:22,my:-9,size:12,delay:465,duration:660,rotate:35},
 {depth:'middle',dx:-27,dy:-54,mx:-5,my:-23,size:14,delay:500,duration:720,rotate:-10},
 {depth:'middle',dx:21,dy:-57,mx:4,my:-25,size:11,delay:535,duration:750,rotate:9},
 {depth:'middle',dx:-55,dy:4,mx:-21,my:-2,size:12,delay:570,duration:610,rotate:-39},
 {depth:'middle',dx:56,dy:2,mx:23,my:-3,size:14,delay:605,duration:640,rotate:42},
 {depth:'middle',dx:-14,dy:-48,mx:3,my:-19,size:12,delay:640,duration:690,rotate:8},
 {depth:'middle',dx:11,dy:-42,mx:-4,my:-17,size:13,delay:675,duration:660,rotate:-7},
 {depth:'front',dx:-62,dy:-28,mx:-20,my:-8,size:27,delay:360,duration:560,rotate:-34},
 {depth:'front',dx:63,dy:-24,mx:24,my:-10,size:30,delay:430,duration:590,rotate:32},
 {depth:'front',dx:-55,dy:15,mx:-18,my:1,size:23,delay:510,duration:540,rotate:-44},
 {depth:'front',dx:57,dy:12,mx:20,my:0,size:25,delay:585,duration:570,rotate:46},
 {depth:'front',dx:8,dy:-66,mx:-5,my:-27,size:22,delay:650,duration:600,rotate:7},
]

function BatSilhouette(){
 return <svg viewBox="0 0 64 30" focusable="false">
  <path className="bat-wing bat-wing-left" d="M31 13C24 7 17 4 7 3l4 6L1 11l8 5-5 6 13-2 7 7 7-10Z"/>
  <path className="bat-wing bat-wing-right" d="M33 13C40 7 47 4 57 3l-4 6 10 2-8 5 5 6-13-2-7 7-7-10Z"/>
  <path className="bat-body" d="M28 11l2-7 2 3 2-3 2 7-1 12-3 6-3-6Z"/>
 </svg>
}

export function BatSwarmLayer(){
 return <div className="app-boot-swarm" aria-hidden="true">
  {flights.map((flight,index)=>{
   const style:FlightStyle={
    '--bat-dx':`${flight.dx}vw`,'--bat-dy':`${flight.dy}vh`,
    '--bat-mx':`${flight.mx}vw`,'--bat-my':`${flight.my}vh`,
    '--bat-size':`${flight.size}px`,'--bat-delay':`${flight.delay}ms`,
    '--bat-duration':`${flight.duration}ms`,'--bat-rotate':`${flight.rotate}deg`,
   }
   return <span className={`app-boot-bat bat-${flight.depth}`} style={style} key={`${flight.depth}-${index}`}><BatSilhouette/></span>
  })}
 </div>
}

export const BAT_SWARM_COUNT=flights.length
