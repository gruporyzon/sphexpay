import { useCallback,useEffect,useState } from 'react'
import { KeyRound,Loader2,ShieldCheck,ShieldOff } from 'lucide-react'
import { authMessage,mfaService,recordSecurityEvent } from '../../services/authService'
import { useAuth } from '../../hooks/useAuth'
import { isSupabaseConfigured } from '../../lib/supabase'

type Mode='loading'|'inactive'|'enrolling'|'active'|'unavailable'
type EnrollData={id:string;qr:string;secret:string}

const onlyDigits=(value:string)=>value.replace(/\D/g,'').slice(0,6)

export function TwoFactorCard(){
 const {refreshAssurance}=useAuth()
 const [mode,setMode]=useState<Mode>('loading')
 const [enroll,setEnroll]=useState<EnrollData|null>(null)
 const [code,setCode]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [activeFactorId,setActiveFactorId]=useState('')

 const load=useCallback(async()=>{
  if(!isSupabaseConfigured){setMode('unavailable');return}
  try{
   const {totp}=await mfaService.listFactors()
   const verified=mfaService.verifiedTotpFactor(totp)
   if(verified){setActiveFactorId(verified.id);setMode('active')}
   else setMode('inactive')
  }catch(reason){setError(authMessage(reason));setMode('inactive')}
 },[])

 useEffect(()=>{void load()},[load])

 const startEnrollment=async()=>{
  setBusy(true);setError('');setNotice('')
  try{
   const data=await mfaService.enroll()
   setEnroll({id:data.id,qr:data.totp.qr_code,secret:data.totp.secret})
   setMode('enrolling')
  }catch(reason){setError(authMessage(reason))}
  finally{setBusy(false)}
 }

 const confirmEnrollment=async()=>{
  if(!enroll)return
  const digits=onlyDigits(code)
  if(digits.length!==6){setError('Digite os 6 dígitos gerados pelo aplicativo.');return}
  setBusy(true);setError('')
  try{
   await mfaService.challengeAndVerify(enroll.id,digits)
   await recordSecurityEvent('mfa.enrolled',{factorType:'totp'})
   await refreshAssurance?.()
   setEnroll(null);setCode('');setNotice('Verificação em duas etapas ativada.')
   await load()
  }catch(reason){setError(authMessage(reason))}
  finally{setBusy(false)}
 }

 const cancelEnrollment=async()=>{
  setBusy(true);setError('')
  try{if(enroll)await mfaService.unenroll(enroll.id)}catch{/* fator não verificado expira sozinho */}
  setEnroll(null);setCode('');setMode('inactive');setBusy(false)
 }

 const disable=async()=>{
  const digits=onlyDigits(code)
  if(digits.length!==6){setError('Confirme com um código atual do aplicativo para desativar.');return}
  setBusy(true);setError('')
  try{
   // Exige AAL2: challengeAndVerify eleva a sessão antes do unenroll.
   await mfaService.challengeAndVerify(activeFactorId,digits)
   await mfaService.unenroll(activeFactorId)
   await recordSecurityEvent('mfa.unenrolled',{factorType:'totp'})
   await refreshAssurance?.()
   setCode('');setActiveFactorId('');setNotice('Verificação em duas etapas desativada.')
   setMode('inactive')
  }catch(reason){setError(authMessage(reason))}
  finally{setBusy(false)}
 }

 if(mode==='unavailable'){
  return <div className="p-5 rounded-xl border border-[var(--line)]">
   <div className="flex items-center gap-2"><ShieldOff size={18}/><b className="text-sm">Verificação em duas etapas</b></div>
   <p className="muted text-xs mt-2">A autenticação ainda não está configurada neste ambiente.</p>
  </div>
 }

 return <div className="p-5 rounded-xl border border-[var(--line)] space-y-4">
  <div className="flex items-start justify-between gap-3">
   <div className="flex items-center gap-2">
    <ShieldCheck size={18} className={mode==='active'?'text-emerald-600':''}/>
    <div>
     <b className="text-sm">Verificação em duas etapas (TOTP)</b>
     <p className="muted text-xs mt-1">Protege o acesso com um código temporário de um aplicativo autenticador.</p>
    </div>
   </div>
   <span className={`text-xs px-2 py-1 rounded-lg ${mode==='active'?'bg-emerald-500/10 text-emerald-600':'bg-[var(--panel-2)] muted'}`}>{mode==='active'?'Ativa':mode==='loading'?'...':'Inativa'}</span>
  </div>

  {mode==='loading'&&<p className="muted text-xs flex items-center gap-2"><Loader2 size={14} className="animate-spin"/> Carregando estado da conta...</p>}

  {mode==='inactive'&&<button className="btn btn-primary" onClick={startEnrollment} disabled={busy}>{busy?<Loader2 size={16} className="animate-spin"/>:<ShieldCheck size={16}/>} Ativar verificação em duas etapas</button>}

  {mode==='enrolling'&&enroll&&<div className="space-y-3">
   <p className="text-xs">1. Escaneie o QR Code no seu aplicativo autenticador (Google Authenticator, 1Password, Authy).</p>
   <img src={enroll.qr} alt="QR Code para configurar a verificação em duas etapas" width={176} height={176} className="rounded-lg border border-[var(--line)] bg-white p-2"/>
   <p className="text-xs muted break-all">Ou informe a chave manualmente: <code className="text-[var(--text)]">{enroll.secret}</code></p>
   <label className="block"><span className="label">2. Código de 6 dígitos</span>
    <input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(onlyDigits(e.target.value))}/>
   </label>
   <div className="flex items-center gap-3">
    <button className="btn btn-primary" onClick={confirmEnrollment} disabled={busy}>{busy?<Loader2 size={16} className="animate-spin"/>:<KeyRound size={16}/>} Confirmar e ativar</button>
    <button className="btn" onClick={cancelEnrollment} disabled={busy}>Cancelar</button>
   </div>
  </div>}

  {mode==='active'&&<div className="space-y-3">
   <p className="text-xs muted">Para desativar, confirme com um código atual do seu aplicativo.</p>
   <label className="block"><span className="label">Código de 6 dígitos</span>
    <input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(onlyDigits(e.target.value))}/>
   </label>
   <button className="btn text-red-500" onClick={disable} disabled={busy}>{busy?<Loader2 size={16} className="animate-spin"/>:<ShieldOff size={16}/>} Desativar verificação em duas etapas</button>
  </div>}

  {error&&<p className="text-xs text-red-500" role="alert">{error}</p>}
  {notice&&<p className="text-xs text-emerald-600" role="status">{notice}</p>}
 </div>
}
