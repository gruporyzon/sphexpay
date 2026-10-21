import { useState,type FormEvent } from 'react'
import { Link,useLocation,useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { SocialLoginButtons } from '../../components/auth/SocialLoginButtons'
import { TwoFactorChallenge } from '../../components/auth/TwoFactorChallenge'
import { supabaseUnavailableMessage } from '../../lib/supabase'
import { authMessage,authService,mfaService,setSessionPersistence } from '../../services/authService'
import { useAuth } from '../../hooks/useAuth'
import { FlowField,FlowNotice,FlowPasswordField,FlowShell } from '../../features/signup/FlowShell'

export default function LoginPage(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[remember,setRemember]=useState(true),[error,setError]=useState(''),[loading,setLoading]=useState(false)
 const [mfaStep,setMfaStep]=useState(false),[pendingDestination,setPendingDestination]=useState('/app')
 const navigate=useNavigate(),location=useLocation(),{configured,refreshAssurance}=useAuth()

 const resolveDestination=(user:{user_metadata?:{onboarding_complete?:boolean}})=>{
  const desired=(location.state as {from?:string}|null)?.from
  const onboarded=Boolean(user.user_metadata?.onboarding_complete)
  return onboarded&&desired?.startsWith('/app')?desired:onboarded?'/app':'/onboarding'
 }

 const goToApp=(destination:string)=>{navigate(destination,{replace:true})}

 const submit=async(event:FormEvent)=>{
  event.preventDefault()
  if(loading)return
  if(!configured){setError(supabaseUnavailableMessage);return}
  setLoading(true);setError('')
  try{
   const {data,error:failure}=await authService.signIn(email.trim(),password)
   if(failure)throw failure
   if(!data.user?.email_confirmed_at){setError('Confirme seu e-mail antes de entrar.');return}
   setSessionPersistence(remember)
   const destination=resolveDestination(data.user)
   // Se a conta tem MFA ativo, a sessão volta em aal1 e precisa do segundo fator.
   const level=await mfaService.assuranceLevel().catch(()=>({currentLevel:null,nextLevel:null}))
   if(level.nextLevel==='aal2'&&level.currentLevel!=='aal2'){
    setPendingDestination(destination)
    setMfaStep(true)
    return
   }
   goToApp(destination)
  }catch(reason){
   setError(authMessage(reason))
  }finally{
   setLoading(false)
  }
 }

 if(mfaStep){
  return <FlowShell back={{to:'/',label:'Voltar para o início'}}>
   <div className="spx-flow-step">
    <span className="spx-flow-eyebrow">Verificação em duas etapas</span>
    <h1>Confirme que é você</h1>
    <p className="spx-flow-subtitle">Sua conta está protegida com verificação em duas etapas.</p>
    <div className="spx-flow-mfa">
     <TwoFactorChallenge
      onVerified={async()=>{await refreshAssurance?.();goToApp(pendingDestination)}}
      onCancel={()=>{setMfaStep(false);setPassword('')}}
     />
    </div>
   </div>
  </FlowShell>
 }

 return <FlowShell back={{to:'/',label:'Voltar para o início'}}>
  <div className="spx-flow-step">
   <h1>Bem-vindo de volta</h1>
   <p className="spx-flow-subtitle">Acesse sua conta SphexPay para acompanhar seus resultados.</p>
   <form className="spx-flow-form" onSubmit={submit} noValidate>
    <FlowField index={0} id="login-email" name="email" label="E-mail" required type="email" value={email} onChange={setEmail} autoComplete="email" inputMode="email" placeholder="seu@email.com"/>
    <FlowPasswordField index={1} label="Senha" required value={password} onChange={setPassword} autoComplete="current-password" placeholder="Sua senha"/>
    <div className="spx-flow-options-row">
     <label className="spx-flow-consent"><input type="checkbox" checked={remember} onChange={event=>setRemember(event.target.checked)}/><span>Manter sessão neste dispositivo</span></label>
     <Link to="/recuperar-senha">Esqueci minha senha</Link>
    </div>
    <FlowNotice message={error}/>
    <button className="spx-flow-button full" disabled={loading} aria-busy={loading}>{loading?<><span className="spx-flow-spinner" aria-hidden="true"/>Validando acesso...</>:<>Entrar <ArrowRight aria-hidden="true"/></>}</button>
   </form>
   <div className="spx-flow-divider"><span>ou</span></div>
   <SocialLoginButtons onError={setError}/>
   <p className="spx-flow-switch">Ainda não possui uma conta? <Link to="/criar-conta">Criar conta</Link></p>
  </div>
 </FlowShell>
}
