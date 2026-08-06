import { useEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent } from 'react'

type Node={lat:number;lon:number;size:number;energy:number}

function createNodes(){
 let seed=417
 const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646}
 return Array.from({length:150},(_,index):Node=>({lat:(random()-.5)*150,lon:(random()-.5)*360,size:index%17===0?2.4:index%7===0?1.7:1,energy:.45+random()*.55}))
}

export function PublicInteractiveGlobe(){
 const canvas=useRef<HTMLCanvasElement>(null),stage=useRef<HTMLDivElement>(null),rotation=useRef({yaw:-.5,pitch:-.12,vx:0,vy:0,lastX:0,lastY:0,dragging:false,lastInteraction:0}),nodes=useMemo(createNodes,[]),[active,setActive]=useState(false)
 useEffect(()=>{
  const element=canvas.current,host=stage.current
  if(!element||!host)return
  const context=(()=>{try{return element.getContext('2d')}catch{return null}})()
  if(!context)return
  const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches
  let width=0,height=0,ratio=1,frame=0,running=true,visible=true,last=performance.now()
  const started=last
  const connections=[[1,18],[18,34],[34,52],[52,77],[77,93],[93,118],[118,136],[8,42],[42,81],[81,121],[25,68],[68,109]] as const
  const project=(node:Pick<Node,'lat'|'lon'>,radius:number)=>{
   const lat=node.lat*Math.PI/180,lon=node.lon*Math.PI/180+rotation.current.yaw,cosLat=Math.cos(lat)
   const x=cosLat*Math.sin(lon),baseY=Math.sin(lat),baseZ=cosLat*Math.cos(lon),cosPitch=Math.cos(rotation.current.pitch),sinPitch=Math.sin(rotation.current.pitch)
   const y=baseY*cosPitch-baseZ*sinPitch,z=baseY*sinPitch+baseZ*cosPitch
   return {x:width/2+x*radius,y:height/2-y*radius,z}
  }
  const drawGrid=(radius:number)=>{
   context.lineWidth=.7;context.strokeStyle='rgba(74,145,255,.16)'
   const line=(points:Array<{lat:number;lon:number}>)=>{let drawing=false;context.beginPath();points.forEach(point=>{const value=project(point,radius);if(value.z<=0){drawing=false;return}if(!drawing){context.moveTo(value.x,value.y);drawing=true}else context.lineTo(value.x,value.y)});context.stroke()}
   for(let lat=-60;lat<=60;lat+=30)line(Array.from({length:73},(_,i)=>({lat,lon:-180+i*5})))
   for(let lon=-150;lon<=180;lon+=30)line(Array.from({length:61},(_,i)=>({lat:-75+i*2.5,lon})))
  }
  const draw=(now:number)=>{
   frame=0
   if(!visible||!running)return
   const delta=Math.min(32,now-last),reveal=Math.min(1,(now-started)/1300);last=now
   if(!reduced){
    const state=rotation.current,idle=now-state.lastInteraction>1200
    if(!state.dragging){state.yaw+=state.vx*delta;state.pitch=Math.max(-.65,Math.min(.65,state.pitch+state.vy*delta));state.vx*=Math.pow(.91,delta/16);state.vy*=Math.pow(.88,delta/16);if(idle)state.yaw+=delta*.000055}
   }
   context.clearRect(0,0,width,height)
   const radius=Math.min(width,height)*.385,cx=width/2,cy=height/2
   const halo=context.createRadialGradient(cx,cy,radius*.42,cx,cy,radius*1.32);halo.addColorStop(0,'rgba(28,99,255,.1)');halo.addColorStop(.6,'rgba(26,102,255,.08)');halo.addColorStop(1,'rgba(11,75,255,0)');context.fillStyle=halo;context.beginPath();context.arc(cx,cy,radius*1.34,0,Math.PI*2);context.fill()
   const sphere=context.createRadialGradient(cx-radius*.28,cy-radius*.34,radius*.08,cx,cy,radius);sphere.addColorStop(0,'rgba(44,116,255,.18)');sphere.addColorStop(.72,'rgba(8,40,104,.16)');sphere.addColorStop(1,'rgba(2,12,35,.62)');context.fillStyle=sphere;context.beginPath();context.arc(cx,cy,radius,0,Math.PI*2);context.fill();context.strokeStyle='rgba(75,151,255,.38)';context.lineWidth=1;context.stroke()
   drawGrid(radius)
   const projected=nodes.map(node=>({...project(node,radius),node}))
   context.lineWidth=.8
   connections.forEach(([from,to],index)=>{const a=projected[from],b=projected[to];if(!a||!b||a.z<=.08||b.z<=.08)return;const alpha=Math.min(a.z,b.z)*(.18+(Math.sin(now*.0015+index)*.5+.5)*.18)*reveal;context.strokeStyle=`rgba(75,151,255,${alpha})`;context.beginPath();context.moveTo(a.x,a.y);context.quadraticCurveTo((a.x+b.x)/2,(a.y+b.y)/2-radius*.08,a.x+(b.x-a.x),a.y+(b.y-a.y));context.stroke()})
   projected.sort((a,b)=>a.z-b.z).forEach(({x,y,z,node},index)=>{if(z<=0)return;const twinkle=.72+Math.sin(now*.002+index*1.7)*.28,alpha=(.2+z*.8)*node.energy*twinkle*reveal,size=node.size*(.55+z*.75);if(node.size>2){context.fillStyle=`rgba(54,139,255,${alpha*.18})`;context.beginPath();context.arc(x,y,size*4.5,0,Math.PI*2);context.fill()}context.fillStyle=`rgba(95,169,255,${alpha})`;context.beginPath();context.arc(x,y,size,0,Math.PI*2);context.fill()})
   if(!reduced)frame=requestAnimationFrame(draw)
  }
  const resize=()=>{const rect=host.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);ratio=Math.min(devicePixelRatio||1,2);element.width=Math.round(width*ratio);element.height=Math.round(height*ratio);element.style.width=`${width}px`;element.style.height=`${height}px`;context.setTransform(ratio,0,0,ratio,0,0);if(reduced)draw(performance.now())}
  const resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(resize):null,visibilityObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(([entry])=>{visible=entry?.isIntersecting??true;if(visible&&!frame)frame=requestAnimationFrame(draw)},{rootMargin:'120px'}):null
  resizeObserver?.observe(host);visibilityObserver?.observe(host);if(!resizeObserver)addEventListener('resize',resize,{passive:true});resize();frame=requestAnimationFrame(draw)
  return()=>{running=false;cancelAnimationFrame(frame);resizeObserver?.disconnect();visibilityObserver?.disconnect();removeEventListener('resize',resize)}
 },[nodes])
 const down=(event:ReactPointerEvent<HTMLCanvasElement>)=>{event.currentTarget.setPointerCapture(event.pointerId);const state=rotation.current;state.dragging=true;state.lastX=event.clientX;state.lastY=event.clientY;state.vx=0;state.vy=0;state.lastInteraction=performance.now();setActive(true)}
 const move=(event:ReactPointerEvent<HTMLCanvasElement>)=>{const state=rotation.current;if(!state.dragging)return;const dx=event.clientX-state.lastX,dy=event.clientY-state.lastY;state.yaw+=dx*.006;state.pitch=Math.max(-.65,Math.min(.65,state.pitch+dy*.004));state.vx=dx*.00022;state.vy=dy*.00015;state.lastX=event.clientX;state.lastY=event.clientY;state.lastInteraction=performance.now()}
 const up=(event:ReactPointerEvent<HTMLCanvasElement>)=>{const state=rotation.current;state.dragging=false;state.lastInteraction=performance.now();if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);setActive(false)}
 return <div ref={stage} className={`spx-globe-stage${active?' is-dragging':''}`} data-motion data-motion-kind="mockup" data-scroll-progress><canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerEnter={()=>setActive(true)} onPointerLeave={event=>{if(!rotation.current.dragging){setActive(false);up(event)}}} role="img" aria-label="Globo interativo ilustrando conexões operacionais. Arraste para rotacionar.">Globo interativo com pontos e conexões.</canvas><span className="spx-globe-hint">ARRASTE PARA EXPLORAR</span><i className="spx-globe-label label-pix">PIX</i><i className="spx-globe-label label-api">API</i><i className="spx-globe-label label-secure">SECURE</i><i className="spx-globe-label label-live">24/7</i></div>
}
