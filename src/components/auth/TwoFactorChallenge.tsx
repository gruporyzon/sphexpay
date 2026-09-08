import { useEffect,useRef,useState,type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { AuthNotice } from './AuthError'
import { authMessage,mfaService,recordSecurityEvent } from '../../services/authService'

// Passo de verificação TOTP reutilizável: pede o código de 6 dígitos do app
// autenticador, resolve o fator verificado e chama challengeAndVerify.
export function TwoFactorChallenge({onVerified,onCancel}:{onVerified:()=>void|Promise<void>;onCancel?:()=>void}){
 const [code,setCode]=useState('')
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(false)
 const [factorId,setFactorId]=useState('')
 const [ready,setReady]=useState(false)
 const inputRef=useRef<HTMLInputElement>(null)

 useEffect(()=>{
  let active=true
  ;(async()=>{
   try{
    const {totp}=await mfaService.listFactors()
    const factor=mfaService.verifiedTotpFactor(totp)
    if(!active)return
    if(!factor){setError('Nenhum fator de verificação ativo foi encontrado nesta conta.');setReady(true);return}
    setFactorId(factor.id)
    setReady(true)
   }catch(reason){if(active){setError(authMessage(reason));setReady(true)}}
  })()
  return()=>{active=false}
 },[])

 useEffect(()=>{if(ready&&factorId)inputRef.current?.focus()},[ready,factorId])

 const submit=async(event:FormEvent)=>{
  event.preventDefault()
  if(loading||!factorId)return
  const digits=code.replace(/\D/g,'')
  if(digits.length!==6){setError('Digite os 6 dígitos gerados pelo aplicativo.');return}
  setLoading(true);setError('')
  try{
   await mfaService.challengeAndVerify(factorId,digits)
   await recordSecurityEvent('mfa.challenge_succeeded')
   await onVerified()
  }catch(reason){
   await recordSecurityEvent('mfa.challenge_failed')
   setError(authMessage(reason))
   setCode('')
  }finally{
   setLoading(false)
  }
 }

 return <form className="auth-form" onSubmit={submit} noValidate>
  <div className="auth-mfa-hint"><ShieldCheck size={18}/><span>Abra seu aplicativo autenticador e informe o código atual da SphexPay.</span></div>
  <label className="auth-field" htmlFor="mfa-code"><span>Código de verificação</span>
   <div className="field-control">
    <input ref={inputRef} id="mfa-code" name="one-time-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6}
     value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
     disabled={!ready||!factorId} required aria-required="true"/>
   </div>
  </label>
  <AuthNotice message={error}/>
  <button className="auth-submit" disabled={loading||!ready||!factorId} aria-busy={loading}>{loading?'Verificando...':'Confirmar acesso'}</button>
  {onCancel&&<button type="button" className="auth-secondary" onClick={onCancel}>Voltar</button>}
 </form>
}
