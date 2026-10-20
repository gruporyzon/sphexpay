import { useState,type FormEvent } from 'react'
import { Link,useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { maskPhoneBR,onlyDigits } from '../../lib/masks'
import { passwordScore } from '../../lib/authValidation'
import { SocialLoginButtons } from '../../components/auth/SocialLoginButtons'
import { supabaseUnavailableMessage } from '../../lib/supabase'
import { authMessage,authService } from '../../services/authService'
import { useAuth } from '../../hooks/useAuth'
import { FlowField,FlowNotice,FlowPasswordField,FlowShell } from '../../features/signup/FlowShell'

type Form={name:string;email:string;phone:string;password:string;confirm:string}
type FieldKey=keyof Form|'consent'

function validate(form:Form,consent:boolean):[FieldKey,string]|null{
 if(form.name.trim().split(/\s+/).length<2)return['name','Informe seu nome completo.']
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))return['email','Informe um e-mail válido.']
 if(onlyDigits(form.phone).length<10)return['phone','Informe um telefone com DDD.']
 if(passwordScore(form.password)<4)return['password','Crie uma senha mais forte, com pelo menos 8 caracteres, maiúscula, número e símbolo.']
 if(form.password!==form.confirm)return['confirm','As senhas não coincidem.']
 if(!consent)return['consent','Aceite os Termos de Uso e a Política de Privacidade.']
 return null
}

function Strength({value}:{value:string}){
 const score=passwordScore(value),label=score<2?'fraca':score<4?'média':'forte'
 return <div className={`spx-flow-strength${value&&score<2?' weak':''}`} aria-live="polite">
  <div aria-hidden="true">{[1,2,3,4,5].map(item=><i className={value&&item<=score?'on':''} key={item}/>)}</div>
  <small>{value?`Força da senha: ${label}`:'Use 8+ caracteres, maiúscula, número e símbolo.'}</small>
 </div>
}

export default function SignupPage(){
 const [form,setForm]=useState<Form>({name:'',email:'',phone:'',password:'',confirm:''}),[consent,setConsent]=useState(false)
 const [error,setError]=useState(''),[invalid,setInvalid]=useState<FieldKey|''>(''),[loading,setLoading]=useState(false)
 const navigate=useNavigate(),{configured}=useAuth()
 const change=(key:keyof Form,value:string)=>{setForm(current=>({...current,[key]:value}));if(invalid===key)setInvalid('')}
 const submit=async(event:FormEvent)=>{
  event.preventDefault()
  if(loading)return
  if(!configured){setError(supabaseUnavailableMessage);return}
  const problem=validate(form,consent)
  if(problem){setInvalid(problem[0]);setError(problem[1]);return}
  setLoading(true);setError('');setInvalid('')
  try{
   const {data,error:failure}=await authService.signUp(form.email.trim(),form.password,{full_name:form.name.trim(),phone:form.phone,onboarding_complete:false})
   if(failure)throw failure
   navigate('/verificar-email',{replace:true,state:{email:form.email.trim(),userCreated:Boolean(data.user)}})
  }catch(reason){setError(authMessage(reason))}
  finally{setLoading(false)}
 }
 return <FlowShell back={{to:'/',label:'Voltar para o início'}}>
  <div className="spx-flow-step">
   <h1>Crie sua conta</h1>
   <p className="spx-flow-subtitle">Preencha os dados abaixo para começar.</p>
   <form className="spx-flow-form" onSubmit={submit} noValidate>
    <FlowField index={0} label="Nome completo" required value={form.name} onChange={value=>change('name',value)} autoComplete="name" placeholder="Seu nome" invalid={invalid==='name'}/>
    <FlowField index={1} label="E-mail" required type="email" value={form.email} onChange={value=>change('email',value)} autoComplete="email" inputMode="email" placeholder="seu@email.com" invalid={invalid==='email'}/>
    <FlowField index={2} label="Telefone" required type="tel" value={form.phone} onChange={value=>change('phone',maskPhoneBR(value))} autoComplete="tel-national" inputMode="numeric" placeholder="(00) 00000-0000" invalid={invalid==='phone'}/>
    <FlowPasswordField index={3} label="Senha" required value={form.password} onChange={value=>change('password',value)} autoComplete="new-password" placeholder="Mínimo 8 caracteres" invalid={invalid==='password'}/>
    <Strength value={form.password}/>
    <FlowPasswordField index={4} label="Confirmar senha" required value={form.confirm} onChange={value=>change('confirm',value)} autoComplete="new-password" placeholder="Repita a senha" invalid={invalid==='confirm'}/>
    <label className="spx-flow-consent"><input type="checkbox" checked={consent} onChange={event=>{setConsent(event.target.checked);if(invalid==='consent')setInvalid('')}} aria-invalid={invalid==='consent'||undefined}/><span>Concordo que li e aceito os <Link to="/termos">Termos de Uso</Link> e a <Link to="/privacidade">Política de Privacidade</Link>.</span></label>
    <FlowNotice message={error}/>
    <button className="spx-flow-button full" disabled={loading} aria-busy={loading}>{loading?<><span className="spx-flow-spinner" aria-hidden="true"/>Criando conta...</>:<>Continuar <ArrowRight aria-hidden="true"/></>}</button>
   </form>
   <div className="spx-flow-divider"><span>ou</span></div>
   <SocialLoginButtons onError={setError}/>
   <p className="spx-flow-switch">Já tem uma conta? <Link to="/entrar">Entrar</Link></p>
  </div>
 </FlowShell>
}
