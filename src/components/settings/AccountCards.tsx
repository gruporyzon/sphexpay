import { useCallback,useEffect,useState,type FormEvent } from 'react'
import { Check,Copy,ExternalLink,Landmark,LogOut,MonitorSmartphone,RotateCcw,Save,ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { T,translate as uiText } from '../../i18n'
import { useAppLocale } from '../../i18n/localeStore'
import { StateMessage } from '../ui'
import { useAuth } from '../../hooks/useAuth'
import { shortDate } from '../../lib/utils'
import { accountService,describeDevice,type AccountSession } from '../../services/accountService'

// Perfil real: nome de exibição editável, e-mail da conta e ID para o suporte.
export function ProfileDetails(){useAppLocale(state=>state.locale)
 const {user}=useAuth(),initial=String(user?.user_metadata?.full_name||'')
 const [name,setName]=useState(initial),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[copied,setCopied]=useState(false)
 const save=async(event:FormEvent)=>{event.preventDefault();setBusy(true);setError('');setMessage('');try{await accountService.updateName(name);setMessage('Nome atualizado.')}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível salvar o nome.')}finally{setBusy(false)}}
 const copy=async()=>{if(!user?.id)return;try{await navigator.clipboard.writeText(user.id);setCopied(true)}catch{setCopied(false)}}
 return <form className="grid sm:grid-cols-2 gap-4" onSubmit={event=>void save(event)}>
  <label><span className="label"><T>Nome</T></span><input className="input" value={name} maxLength={120} onChange={event=>setName(event.target.value)}/></label>
  <label><span className="label"><T>E-mail</T></span><input className="input" value={user?.email||''} readOnly aria-readonly="true"/></label>
  <div className="sm:col-span-2"><span className="label"><T>ID da conta</T></span><div className="flex items-center gap-2"><code className="input flex items-center truncate">{user?.id||'-'}</code><button type="button" className="btn icon-btn" aria-label={uiText('Copiar ID da conta')} onClick={()=>void copy()}>{copied?<Check/>:<Copy/>}</button></div><small className="muted"><T>Informe este ID ao suporte quando precisar de ajuda com a sua conta.</T></small></div>
  <div className="sm:col-span-2 flex items-center gap-3"><button className="btn btn-primary" disabled={busy||name.trim()===initial.trim()||name.trim().length<2}><Save size={15}/><T>{busy?' Salvando...':' Salvar nome'}</T></button>{message&&<span className="muted text-sm" role="status"><T>{message}</T></span>}</div>
  {error&&<div className="sm:col-span-2"><StateMessage title={uiText('Atenção')}><span>{error}</span></StateMessage></div>}
 </form>
}

// Aparelhos conectados de verdade; encerrar acesso usa a API oficial (todas as outras sessões).
export function SessionsCard(){useAppLocale(state=>state.locale)
 const [items,setItems]=useState<AccountSession[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[notice,setNotice]=useState('')
 const load=useCallback(()=>{setError('');accountService.sessions().then(setItems).catch(reason=>{setItems([]);setError(reason instanceof Error?reason.message:'Não foi possível carregar os aparelhos conectados.')})},[])
 useEffect(()=>{load()},[load])
 const endOthers=async()=>{setBusy('others');setError('');setNotice('');try{await accountService.signOutOthers();setNotice('Outras sessões encerradas.');load()}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível encerrar as outras sessões.')}finally{setBusy('')}}
 const others=(items||[]).filter(item=>!item.current).length
 return <div className="security-sessions"><div className="flex flex-wrap items-center justify-between gap-2"><h3><T>Aparelhos conectados</T></h3><button type="button" className="btn" disabled={!others||Boolean(busy)} onClick={()=>void endOthers()}><LogOut size={15}/><T> Sair de todos os outros</T></button></div>
  {error&&<StateMessage title={uiText('Atenção')}><span>{error}</span> <button type="button" className="btn" onClick={load}><RotateCcw size={14}/><T> Tentar novamente</T></button></StateMessage>}
  {notice&&<p className="muted text-sm" role="status"><T>{notice}</T></p>}<p className="muted text-xs"><T>Viu um aparelho que não reconhece? Use Sair de todos os outros e troque sua senha.</T></p>
  {items===null?<p className="muted text-sm"><T>Carregando aparelhos…</T></p>:items.map(item=><div key={item.id}><span><b className="flex items-center gap-2"><MonitorSmartphone size={15}/>{describeDevice(item.userAgent)}{item.aal==='aal2'&&<ShieldCheck size={14} aria-label={uiText('Verificado em duas etapas')}/>}</b><small>{item.current?uiText('Este aparelho'):`${uiText('Último acesso')} ${shortDate(item.lastSeenAt)}`}{item.ip?` · ${item.ip}`:''} · {uiText('Entrou em')} {shortDate(item.createdAt)}</small></span>{item.current&&<span className="badge badge-ok"><T>Atual</T></span>}</div>)}
 </div>
}

// A conta de recebimento fica na Stripe: nada de dados bancários guardados pela SphexPay.
export function PayoutAccountNotice(){useAppLocale(state=>state.locale)
 return <div className="p-5 rounded-xl border border-[var(--line)]"><b className="flex items-center gap-2"><Landmark size={16}/><T>Conta de recebimento</T></b><p className="muted text-sm mt-2"><T>A conta bancária que recebe os repasses é cadastrada e protegida pela Stripe durante a ativação dos pagamentos. A SphexPay não guarda agência nem número de conta.</T></p><div className="flex flex-wrap gap-2 mt-4"><Link className="btn" to="/app/financeiro/saques"><T>Ver repasses</T></Link><a className="btn" href="https://dashboard.stripe.com/settings/payouts" target="_blank" rel="noreferrer"><ExternalLink size={15}/><T> Alterar conta na Stripe</T></a></div></div>
}
