import { useEffect,useRef,useState } from 'react'
import { Link,useLocation } from 'react-router-dom'
import { CheckCircle2,MailCheck } from 'lucide-react'
import { authMessage,authService } from '../../services/authService'
import { FlowNotice,FlowShell } from '../../features/signup/FlowShell'

export default function VerifyEmailPage(){
 const location=useLocation(),email=(location.state as {email?:string}|null)?.email??''
 const [message,setMessage]=useState(''),[cooldown,setCooldown]=useState(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null)
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[])
 const resend=async()=>{
  if(!email||cooldown)return
  setCooldown(true)
  try{const {error}=await authService.resendConfirmation(email);if(error)throw error;setMessage('Novo e-mail enviado. Verifique também a caixa de spam.')}
  catch(reason){setMessage(authMessage(reason))}
  timer.current=setTimeout(()=>setCooldown(false),60000)
 }
 return <FlowShell back={{to:'/',label:'Voltar para o início'}}>
  <div className="spx-flow-step">
   <div className="spx-flow-icon" aria-hidden="true"><MailCheck/></div>
   <span className="spx-flow-eyebrow">Confirmação de e-mail</span>
   <h1>Confirme seu e-mail</h1>
   <p className="spx-flow-subtitle">Enviamos uma mensagem{email?<> para <strong>{email}</strong></>:''}. Abra o e-mail para ativar sua conta e continuar o cadastro.</p>
   <div className="spx-flow-checklist"><span><CheckCircle2 aria-hidden="true"/> Verifique sua caixa de entrada</span><span><CheckCircle2 aria-hidden="true"/> Confira também a pasta de spam</span><span><CheckCircle2 aria-hidden="true"/> O link direcionará você com segurança</span></div>
   <FlowNotice message={message} success={message.startsWith('Novo')}/>
   <button type="button" className="spx-flow-button full" onClick={resend} disabled={!email||cooldown} style={{marginTop:message?14:0}}>{cooldown?'Aguarde para reenviar':'Reenviar confirmação'}</button>
   <p className="spx-flow-switch"><Link to="/criar-conta">Trocar e-mail</Link> · <Link to="/entrar">Voltar ao login</Link></p>
  </div>
 </FlowShell>
}
