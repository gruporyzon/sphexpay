import { useEffect,useRef } from 'react'
import { BAT_QUALITY_COUNTS,getBatQuality } from './batSwarmConfig'

type Particle={
 x:number;y:number;vx:number;vy:number;depth:number;scale:number;rotation:number;wingPhase:number;variant:number
 spawnAt:number;targeted:boolean;targetIndex:number;opacity:number
}

const MASK_SOURCE='/brand/sphex-symbol-mask.png'
const SCENE_DURATION=2200

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value))
const smooth=(from:number,to:number,value:number)=>{const x=clamp((value-from)/(to-from),0,1);return x*x*(3-2*x)}

function seededRandom(seed=0x5f3759df){return()=>{seed=Math.imul(seed^seed>>>15,1|seed);seed^=seed+Math.imul(seed^seed>>>7,61|seed);return((seed^seed>>>14)>>>0)/4294967296}}

function makeParticles(count:number,width:number,height:number,random:()=>number):Particle[]{
 return Array.from({length:count},(_,index)=>{
  const depth=index<count*.27?.45:index<count*.9?1:1.75
  const edge=index%4,margin=width*.14
  const x=edge===0?-margin:edge===1?width+margin:random()*width
  const y=edge===2?height+margin:edge===3?height*(.72+random()*.32):height*(.08+random()*.74)
  const angle=Math.atan2(height*.48-y,width*.5-x)+(random()-.5)*1.25
  const speed=(.035+random()*.055)*(1+depth*.22)
  return{x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,depth,scale:(3.2+random()*4.8)*depth,rotation:angle,wingPhase:random()*Math.PI*2,variant:index%3,spawnAt:170+random()*620,targeted:index<count*.78,targetIndex:index,opacity:0}
 })
}

function sampleMask(image:HTMLImageElement,count:number,random:()=>number){
 const canvas=document.createElement('canvas');canvas.width=180;canvas.height=260
 const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return[] as Array<[number,number]>
 context.clearRect(0,0,canvas.width,canvas.height)
 const ratio=Math.min(154/image.width,232/image.height),width=image.width*ratio,height=image.height*ratio
 context.drawImage(image,(canvas.width-width)/2,(canvas.height-height)/2,width,height)
 const pixels=context.getImageData(0,0,canvas.width,canvas.height).data
 const candidates:Array<[number,number]>=[]
 for(let y=8;y<canvas.height-8;y+=3)for(let x=8;x<canvas.width-8;x+=3)if(pixels[(y*canvas.width+x)*4+3]>72)candidates.push([(x-canvas.width/2)/154,(y-canvas.height/2)/232])
 const points:Array<[number,number]>=[]
 while(points.length<count&&candidates.length){const index=Math.floor(random()*candidates.length);points.push(candidates.splice(index,1)[0])}
 return points
}

function drawBat(context:CanvasRenderingContext2D,particle:Particle,time:number,alpha:number){
 const flap=Math.sin(time*(.0105+particle.variant*.0018)+particle.wingPhase)
 const wing=clamp(.54+flap*.32,.2,.92),size=particle.scale
 context.save();context.translate(particle.x,particle.y);context.rotate(particle.rotation);context.scale(size,size)
 context.globalAlpha=alpha;context.fillStyle=particle.depth<.7?'#471719':particle.depth>1.5?'#090506':'#160809';context.filter=particle.depth<.7?'blur(.45px)':particle.depth>1.5?'blur(.7px)':'none'
 context.beginPath();context.moveTo(0,-.12)
 context.bezierCurveTo(-.55,-wing,-1.12,-.78,-1.65,-.42)
 context.lineTo(-1.28,-.08);context.lineTo(-1.72,.12);context.lineTo(-1.04,.28)
 context.quadraticCurveTo(-.52,.62,-.12,.35);context.lineTo(0,.86)
 context.lineTo(.12,.35);context.quadraticCurveTo(.52,.62,1.04,.28)
 context.lineTo(1.72,.12);context.lineTo(1.28,-.08)
 context.lineTo(1.65,-.42);context.bezierCurveTo(1.12,-.78,.55,-wing,0,-.12)
 context.closePath();context.fill();context.restore()
}

export function BatSwarmScene({reducedMotion=false,onFailure}:{reducedMotion?:boolean;onFailure?:()=>void}){
 const canvasRef=useRef<HTMLCanvasElement>(null)
 useEffect(()=>{
  if(reducedMotion)return
  const canvas=canvasRef.current,context=canvas?.getContext('2d')
  if(!canvas||!context){onFailure?.();return}
  let disposed=false,frame=0,width=0,height=0,dpr=1,particles:Particle[]=[],targets:Array<[number,number]>=[]
  const random=seededRandom(),cores=navigator.hardwareConcurrency||4
  const resize=()=>{
   const previousWidth=width,previousHeight=height;width=window.innerWidth;height=window.innerHeight
   const quality=getBatQuality({width,dpr:window.devicePixelRatio||1,cores})
   dpr=Math.min(window.devicePixelRatio||1,quality==='high'?2:1.5)
   canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=`${width}px`;canvas.style.height=`${height}px`
   context.setTransform(dpr,0,0,dpr,0,0)
   if(!particles.length)particles=makeParticles(BAT_QUALITY_COUNTS[quality],width,height,random)
   else if(previousWidth&&previousHeight)for(const particle of particles){particle.x*=width/previousWidth;particle.y*=height/previousHeight}
  }
  resize();window.addEventListener('resize',resize,{passive:true})
  const image=new Image()
  image.onload=()=>{if(!disposed)targets=sampleMask(image,Math.ceil(particles.length*.78),random)}
  image.onerror=()=>onFailure?.();image.src=MASK_SOURCE
  const started=performance.now();let previousFrame=started
  const render=(now:number)=>{
   if(disposed)return
   const elapsed=now-started,dt=clamp(now-previousFrame,8,34),progress=clamp(elapsed/SCENE_DURATION,0,1),attraction=smooth(.34,.76,progress),lock=smooth(.7,.9,progress);previousFrame=now
   context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height)
   const markWidth=clamp(width*.37,132,190),markHeight=markWidth*1.45,centerX=width*.5,centerY=height*.47
   for(let index=0;index<particles.length;index++){
    const particle=particles[index]
    if(elapsed<particle.spawnAt)continue
    const noise=Math.sin(elapsed*.0018+particle.wingPhase)*.0018
    if(particle.targeted&&targets.length){
     const target=targets[particle.targetIndex%targets.length],tx=centerX+target[0]*markWidth,ty=centerY+target[1]*markHeight
     const pull=.00035+attraction*.0065+lock*.012
     particle.vx+=(tx-particle.x)*pull;particle.vy+=(ty-particle.y)*pull
     const damping=.965-attraction*.08;particle.vx*=damping;particle.vy*=damping
     if(lock>.72){particle.x+=(tx-particle.x)*(.035+lock*.13);particle.y+=(ty-particle.y)*(.035+lock*.13)}
    }else{
     const orbit=Math.atan2(particle.y-centerY,particle.x-centerX)+Math.PI/2
     particle.vx+=Math.cos(orbit)*noise;particle.vy+=Math.sin(orbit)*noise
    }
    const neighbor=particles[index?index-1:particles.length-1],rx=particle.x-neighbor.x,ry=particle.y-neighbor.y,distanceSquared=rx*rx+ry*ry
    if(distanceSquared>1&&distanceSquared<484){const repel=(1-lock)*.006/distanceSquared;particle.vx+=rx*repel;particle.vy+=ry*repel}
    particle.x+=particle.vx*dt;particle.y+=particle.vy*dt
    particle.rotation=Math.atan2(particle.vy,particle.vx)+Math.sin(elapsed*.004+particle.wingPhase)*.15
    const enter=smooth(particle.spawnAt,particle.spawnAt+170,elapsed),exit=particle.targeted?1:1-smooth(.72,.96,progress)
    particle.opacity=enter*exit*(particle.depth<.7?.42:.92)*(1-lock*(particle.targeted?.3:0))
    drawBat(context,particle,elapsed,particle.opacity)
   }
   context.filter='none'
   if(elapsed<SCENE_DURATION*1.04)frame=requestAnimationFrame(render)
  }
  frame=requestAnimationFrame(render)
  return()=>{disposed=true;cancelAnimationFrame(frame);window.removeEventListener('resize',resize);image.onload=null;image.onerror=null;context.clearRect(0,0,width,height)}
 },[onFailure,reducedMotion])
 return <canvas className="app-boot-swarm" ref={canvasRef} aria-hidden="true"/>
}
