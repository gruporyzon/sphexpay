import { useEffect,useState } from 'react'
import './authLoading.css'

// Abertura enquanto a sessão é validada: símbolo com brilho azul, anel orbital, nome revelado letra a
// letra e etapas que avançam. Aparece com um pequeno atraso para não piscar em carregamentos rápidos.
const STEPS=['Validando acesso seguro','Protegendo sua sessão','Preparando seu painel']
const WORD='SphexPay'

export function AuthLoading(){
 const [step,setStep]=useState(0)
 useEffect(()=>{const timer=window.setInterval(()=>setStep(current=>Math.min(current+1,STEPS.length-1)),1500);return()=>clearInterval(timer)},[])
 return <main className="auth-loading" aria-busy="true">
  <div className="auth-loading-aura" aria-hidden="true"/>
  <div className="auth-loading-grid" aria-hidden="true"/>
  <div className="auth-loading-stage">
   <div className="auth-loading-core" aria-hidden="true">
    <svg className="auth-loading-orbit" viewBox="0 0 120 120">
     <defs><linearGradient id="auth-loading-arc" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#53ddff"/><stop offset="55%" stopColor="#0080ff"/><stop offset="100%" stopColor="#0080ff" stopOpacity="0"/></linearGradient></defs>
     <circle className="auth-loading-track" cx="60" cy="60" r="54"/>
     <circle className="auth-loading-arc" cx="60" cy="60" r="54" stroke="url(#auth-loading-arc)"/>
    </svg>
    <span className="auth-loading-ring"/>
    <span className="auth-loading-mark"/>
   </div>
   <p className="auth-loading-word" aria-label={WORD}>{[...WORD].map((letter,index)=><span key={index} style={{animationDelay:`${.35+index*.06}s`}} aria-hidden="true">{letter}</span>)}</p>
   <div className="auth-loading-line" aria-hidden="true"><i/></div>
   <span key={step} className="auth-loading-status" role="status" aria-live="polite">{STEPS[step]}</span>
  </div>
 </main>
}
