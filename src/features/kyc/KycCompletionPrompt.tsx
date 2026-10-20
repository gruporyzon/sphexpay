import { useEffect,useRef,useState } from 'react'
import { useLocation,useNavigate } from 'react-router-dom'
import { ArrowRight,ShieldCheck,X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { kycService } from './kycService'
import type { KycStatus } from './types'
import './kyc.css'

// Lembrete ao entrar no painel enquanto a verificação (KYC) não foi enviada ou precisa de
// ajustes. "Fazer depois" esconde até a próxima sessão do navegador.
const PROMPT_STATUSES:ReadonlyArray<KycStatus|'none'>=['none','draft','rejected','needs_more_info']
const dismissKey=(userId:string)=>`sphexpay:kyc-prompt-dismissed:${userId}`

const COPY:Record<'start'|'fix',{title:string;text:string}>={
 start:{title:'Conclua sua verificação',text:'Envie seus dados cadastrais e documentos para liberar recebimentos na SphexPay. Leva poucos minutos e a análise é feita pela nossa equipe.'},
 fix:{title:'Sua verificação precisa de ajustes',text:'Nossa equipe revisou seu cadastro e pediu correções. Ajuste os dados indicados e reenvie para liberar recebimentos.'}
}

export function KycCompletionPrompt(){
 const {user}=useAuth(),navigate=useNavigate(),{pathname}=useLocation()
 const [status,setStatus]=useState<KycStatus|'none'|null>(null),[open,setOpen]=useState(false)
 const primary=useRef<HTMLButtonElement>(null)

 useEffect(()=>{
  if(!user?.id)return
  let active=true
  try{if(sessionStorage.getItem(dismissKey(user.id)))return}catch{/* armazenamento indisponível */}
  kycService.overview(user.id)
   .then(overview=>{if(!active)return;const next=overview.profile?.status??'none';setStatus(next);setOpen(PROMPT_STATUSES.includes(next))})
   .catch(()=>{/* sem módulo de verificação neste ambiente */})
  return()=>{active=false}
 },[user?.id])

 const visible=open&&!pathname.startsWith('/app/verificacao')
 const dismiss=()=>{setOpen(false);if(user?.id){try{sessionStorage.setItem(dismissKey(user.id),'1')}catch{/* armazenamento indisponível */}}}
 const start=()=>{setOpen(false);navigate('/app/verificacao')}
 const dismissRef=useRef(dismiss)
 dismissRef.current=dismiss
 useEffect(()=>{
  if(!visible)return
  primary.current?.focus()
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')dismissRef.current()}
  addEventListener('keydown',onKey)
  return()=>removeEventListener('keydown',onKey)
 },[visible])

 if(!visible)return null
 const copy=status==='rejected'||status==='needs_more_info'?COPY.fix:COPY.start
 return <div className="kyc-prompt-backdrop" onClick={event=>{if(event.target===event.currentTarget)dismiss()}}>
  <div className="kyc-prompt" role="dialog" aria-modal="true" aria-labelledby="kyc-prompt-title" aria-describedby="kyc-prompt-text">
   <button type="button" className="kyc-prompt-close" aria-label="Fechar" onClick={dismiss}><X aria-hidden="true"/></button>
   <span className="kyc-prompt-icon" aria-hidden="true"><ShieldCheck/></span>
   <h2 id="kyc-prompt-title">{copy.title}</h2>
   <p id="kyc-prompt-text">{copy.text}</p>
   <ol className="kyc-prompt-steps"><li><b>1</b>Dados cadastrais</li><li><b>2</b>Documentos</li><li><b>3</b>Análise da equipe</li></ol>
   <div className="kyc-prompt-actions">
    <button type="button" className="kyc-prompt-secondary" onClick={dismiss}>Fazer depois</button>
    <button type="button" ref={primary} className="kyc-prompt-primary" onClick={start}>Concluir verificação <ArrowRight aria-hidden="true"/></button>
   </div>
  </div>
 </div>
}
