import { useEffect,useState } from 'react'
import './authLoading.css'

// Abertura do aplicativo: partículas em espiral convergem para o centro, o símbolo se constrói de baixo
// para cima com uma linha de luz, explode em ondas de energia e o nome surge letra a letra. Na saída
// (overlay), a tela se abre a partir do centro revelando o painel, que já carregou por baixo.
const STEPS=['Validando acesso seguro','Protegendo sua sessão','Preparando seu painel']
const WORD='SphexPay'
const PARTICLES=Array.from({length:22},(_,index)=>({angle:index*(360/22)+(index%3)*7,delay:.05+(index%7)*.07,distance:150+(index*37)%110,size:index%4===0?4:index%3===0?3:2}))

export function AuthLoading({overlay=false,leaving=false}:{overlay?:boolean;leaving?:boolean}){
 const [step,setStep]=useState(0)
 useEffect(()=>{const timer=window.setInterval(()=>setStep(current=>Math.min(current+1,STEPS.length-1)),950);return()=>clearInterval(timer)},[])
 return <main className={`auth-loading${overlay?' auth-loading-overlay':''}${leaving?' is-leaving':''}`} aria-busy={!leaving}>
  <div className="auth-loading-aurora" aria-hidden="true"/>
  <div className="auth-loading-grid" aria-hidden="true"/>
  <div className="auth-loading-stage">
   <div className="auth-loading-core" aria-hidden="true">
    <div className="auth-loading-particles">{PARTICLES.map((particle,index)=><i key={index} style={{'--a':`${particle.angle}deg`,'--d':`${particle.delay}s`,'--r':`${particle.distance}px`,'--s':`${particle.size}px`} as React.CSSProperties}/>)}</div>
    <span className="auth-loading-wave"/><span className="auth-loading-wave is-late"/>
    <svg className="auth-loading-orbit" viewBox="0 0 120 120">
     <defs><linearGradient id="auth-loading-arc" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#53ddff"/><stop offset="55%" stopColor="#0080ff"/><stop offset="100%" stopColor="#0080ff" stopOpacity="0"/></linearGradient></defs>
     <circle className="auth-loading-track" cx="60" cy="60" r="54"/>
     <circle className="auth-loading-arc" cx="60" cy="60" r="54" stroke="url(#auth-loading-arc)"/>
    </svg>
    <span className="auth-loading-glow"/>
    <span className="auth-loading-mark"><span className="auth-loading-scan"/></span>
   </div>
   <p className="auth-loading-word" aria-label={WORD}>{[...WORD].map((letter,index)=><span key={index} style={{'--l':index} as React.CSSProperties} aria-hidden="true">{letter}</span>)}</p>
   <div className="auth-loading-line" aria-hidden="true"><i/></div>
   <span key={step} className={`auth-loading-status${step===0?' is-first':''}`} role="status" aria-live="polite">{STEPS[step]}</span>
  </div>
 </main>
}
