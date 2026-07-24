import { useState,type FormEvent } from 'react'
import { Link,useLocation,useNavigate } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { PasswordField } from '../../components/auth/PasswordField'
import { SocialLoginButtons } from '../../components/auth/SocialLoginButtons'
import { AuthNotice } from '../../components/auth/AuthError'
import { supabaseUnavailableMessage } from '../../lib/supabase'
import { authMessage,authService,setSessionPersistence } from '../../services/authService'
import { useAuth } from '../../hooks/useAuth'

export default function LoginPage(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[remember,setRemember]=useState(true),[error,setError]=useState(''),[loading,setLoading]=useState(false)
 const navigate=useNavigate(),location=useLocation(),{configured}=useAuth()
 const submit=async(event:FormEvent)=>{event.preventDefault();if(loading)return;if(!configured){setError(supabaseUnavailableMessage);return}setLoading(true);setError('');try{const {data,error:failure}=await authService.signIn(email.trim(),password);if(failure)throw failure;if(!data.user?.email_confirmed_at){setError('Confirme seu e-mail antes de entrar.');return}setSessionPersistence(remember);const desired=(location.state as {from?:string}|null)?.from,onboarded=Boolean(data.user.user_metadata?.onboarding_complete),destination=onboarded&&desired?.startsWith('/app')?desired:onboarded?'/app':'/onboarding';navigate(destination,{replace:true})}catch(reason){setError(authMessage(reason))}finally{setLoading(false)}}
 return <AuthLayout><h1>Bem-vindo de volta</h1><p className="auth-subtitle">Acesse sua conta SphexPay para acompanhar seus resultados.</p><SocialLoginButtons onError={setError}/><div className="auth-divider"><span>ou continue com e-mail</span></div><form className="auth-form" onSubmit={submit} noValidate><label className="auth-field" htmlFor="login-email"><span>E-mail</span><div className="field-control"><Mail/><input id="login-email" name="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" inputMode="email" required aria-required="true"/></div></label><PasswordField label="Senha" value={password} onChange={setPassword}/><div className="auth-options"><label><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> Manter sessão neste dispositivo</label><Link to="/recuperar-senha">Esqueci minha senha</Link></div><AuthNotice message={error}/><button className="auth-submit" disabled={loading} aria-busy={loading}>{loading?'Validando acesso...':'Entrar'}</button></form><p className="auth-switch">Ainda não possui uma conta? <Link to="/criar-conta">Criar conta</Link></p></AuthLayout>
}
