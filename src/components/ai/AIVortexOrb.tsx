import { useEffect,useRef } from 'react'

export type AIVortexState='idle'|'listening'|'processing'|'speaking'|'paused'|'error'
type Particle={angle:number;radius:number;speed:number;size:number;alpha:number;direction:1|-1;phase:number}
const labels:Record<AIVortexState,string>={idle:'Pronta para ajudar',listening:'Ouvindo você',processing:'Analisando seus dados',speaking:'Respondendo',paused:'Resposta pausada',error:'Verifique o acesso de voz'}

export function AIVortexOrb({state,level=0}:{state:AIVortexState;level?:number}){
 const canvas=useRef<HTMLCanvasElement>(null),stateRef=useRef(state),levelRef=useRef(level)
 stateRef.current=state
 levelRef.current=Math.max(0,Math.min(1,level))

 useEffect(()=>{
  const element=canvas.current
  if(!element)return
  const context=element.getContext('2d')
  if(!context)return
  const mobile=matchMedia('(max-width: 767px)').matches,reducedQuery=matchMedia('(prefers-reduced-motion: reduce)')
  let width=0,height=0,dpr=1,frame=0,visible=!document.hidden,reduced=reducedQuery.matches,lastFrame=0
  let particles:Particle[]=[]
  const createParticles=()=>{
   const count=reduced?12:mobile?38:68
   particles=Array.from({length:count},(_,index)=>({angle:Math.random()*Math.PI*2,radius:.2+Math.random()*.72,speed:.00008+Math.random()*.00022,size:.6+Math.random()*1.6,alpha:.25+Math.random()*.7,direction:index%3===0?-1:1,phase:Math.random()*Math.PI*2}))
  }
  const resize=()=>{
   const bounds=element.getBoundingClientRect()
   width=Math.max(1,bounds.width);height=Math.max(1,bounds.height);dpr=Math.min(2,devicePixelRatio||1)
   element.width=Math.round(width*dpr);element.height=Math.round(height*dpr)
   context.setTransform(dpr,0,0,dpr,0,0)
   createParticles()
  }
  const drawArc=(cx:number,cy:number,radius:number,start:number,length:number,lineWidth:number,color:string,blur:number)=>{
   context.beginPath();context.arc(cx,cy,radius,start,start+length);context.lineCap='round';context.lineWidth=lineWidth;context.strokeStyle=color;context.shadowColor=color;context.shadowBlur=blur;context.stroke();context.shadowBlur=0
  }
  const draw=(time:number)=>{
   frame=requestAnimationFrame(draw)
   if(!visible)return
   const minDelay=mobile?1000/45:1000/60
   if(time-lastFrame<minDelay)return
   lastFrame=time
   const current=stateRef.current,input=levelRef.current,cx=width/2,cy=height/2,size=Math.min(width,height),base=size*.285
   const activity=current==='listening'?input:current==='speaking'?Math.max(input,.25+Math.abs(Math.sin(time*.007))*.35):current==='processing'?.62:current==='error'?.25:current==='paused'?.08:.16
   const speed=reduced?.00004:current==='processing'?.00105:current==='speaking'?.00072:current==='listening'?.00055:current==='paused'?.00008:.00024
   context.clearRect(0,0,width,height)
   const halo=context.createRadialGradient(cx,cy,base*.25,cx,cy,base*1.9)
   halo.addColorStop(0,`rgba(255,72,18,${.18+activity*.12})`);halo.addColorStop(.42,`rgba(241,90,36,${.12+activity*.1})`);halo.addColorStop(1,'rgba(241,90,36,0)')
   context.fillStyle=halo;context.beginPath();context.arc(cx,cy,base*1.9,0,Math.PI*2);context.fill()
   context.save();context.translate(cx,cy);context.scale(1,.78);context.translate(-cx,-cy)
   const colors=current==='error'?['rgba(255,54,45,.8)','rgba(244,84,52,.5)','rgba(255,159,145,.7)']:['rgba(255,91,27,.92)','rgba(230,47,17,.72)','rgba(255,151,188,.64)','rgba(255,238,220,.78)']
   const rings=reduced?4:8
   for(let ring=0;ring<rings;ring++){
    const radius=base*(.62+ring*.105),direction=ring%2?1:-1,rotation=time*speed*direction*(1+ring*.075)+ring*1.31
    const segments=ring%3===0?3:2
    for(let segment=0;segment<segments;segment++){
     const start=rotation+segment*(Math.PI*2/segments)+Math.sin(time*.0007+ring)*.14
     const length=.48+((ring+segment)%4)*.23+activity*.16
     drawArc(cx,cy,radius,start,length,1+ring*.22+activity*1.5,colors[(ring+segment)%colors.length],8+activity*16)
    }
   }
   context.restore()
   particles.forEach((particle,index)=>{
    const pull=current==='processing'?-.00016:current==='speaking'&&index%5===0?.00012:0
    particle.angle+=particle.speed*particle.direction*(reduced?.25:1)*(1+activity*2.2)*(time-lastFrame+minDelay)
    particle.radius+=pull
    if(particle.radius<.16)particle.radius=.9
    if(particle.radius>1.05)particle.radius=.22
    const orbit=base*(.55+particle.radius),x=cx+Math.cos(particle.angle)*orbit,y=cy+Math.sin(particle.angle)*orbit*.78
    const pink=index%11===0,white=index%17===0
    context.fillStyle=white?`rgba(255,245,235,${particle.alpha})`:pink?`rgba(255,135,180,${particle.alpha})`:`rgba(255,99,32,${particle.alpha})`
    context.shadowColor=context.fillStyle;context.shadowBlur=white?9:5
    context.beginPath();context.arc(x,y,particle.size*(1+activity*.45),0,Math.PI*2);context.fill()
   })
   context.shadowBlur=0
   if(!reduced&&Math.sin(time*.0031)>.985){
    const angle=time*.0017,x=cx+Math.cos(angle)*base*1.18,y=cy+Math.sin(angle)*base*.9
    context.fillStyle='rgba(255,245,238,.9)';context.shadowColor='#fff1e8';context.shadowBlur=18;context.beginPath();context.arc(x,y,1.8+activity*1.8,0,Math.PI*2);context.fill();context.shadowBlur=0
   }
   const core=context.createRadialGradient(cx-base*.12,cy-base*.14,base*.05,cx,cy,base*.58)
   core.addColorStop(0,'#020203');core.addColorStop(.48,'#060608');core.addColorStop(.76,current==='error'?'#35100e':'#1b0905');core.addColorStop(.9,`rgba(255,78,20,${.45+activity*.25})`);core.addColorStop(1,'rgba(255,88,25,0)')
   context.fillStyle=core;context.shadowColor=current==='error'?'#ef3d2f':'#ff541c';context.shadowBlur=18+activity*24;context.beginPath();context.arc(cx,cy,base*(.58+activity*.025),0,Math.PI*2);context.fill();context.shadowBlur=0
   const rim=context.createRadialGradient(cx,cy,0,cx,cy,base*.46);rim.addColorStop(0,'rgba(0,0,0,.96)');rim.addColorStop(.72,'rgba(2,2,3,.98)');rim.addColorStop(1,'rgba(255,111,49,.14)')
   context.fillStyle=rim;context.beginPath();context.arc(cx,cy,base*.44,0,Math.PI*2);context.fill()
  }
  const observer=new ResizeObserver(resize),visibility=()=>{visible=!document.hidden;if(visible)lastFrame=0},motion=()=>{reduced=reducedQuery.matches;createParticles()}
  observer.observe(element);resize();document.addEventListener('visibilitychange',visibility);reducedQuery.addEventListener?.('change',motion);frame=requestAnimationFrame(draw)
  return()=>{cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);reducedQuery.removeEventListener?.('change',motion);context.clearRect(0,0,width,height)}
 },[])

 return <div className={`ai-vortex-stage ${state}`} role="img" aria-label={`SphexPay Intelligence: ${labels[state]}`}><canvas ref={canvas} className="ai-vortex-canvas"/><div className="ai-vortex-status"><i/><span>{labels[state]}</span>{state==='listening'&&<b>{Math.round(levelRef.current*100)}%</b>}</div></div>
}
