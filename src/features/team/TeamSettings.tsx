import { useCallback,useEffect,useState,type FormEvent } from 'react'
import { Check,Copy,UserMinus,UserPlus,Users } from 'lucide-react'
import { T,translate as uiText } from '../../i18n'
import { useAppLocale } from '../../i18n/localeStore'
import { Empty,Loading,StateMessage } from '../../components/ui'
import { shortDate } from '../../lib/utils'
import { ROLE_DESCRIPTION,ROLE_LABEL,teamService,type TeamMember } from '../../services/teamService'
import type { TeamRole } from '../../store/useWorkspaceStore'

const ROLES:TeamRole[]=['admin','finance','support']
const STATUS_LABEL:Record<TeamMember['status'],string>={invited:'Convite pendente',active:'Ativo',expired:'Convite expirado'}

// Equipe da conta: convite por link com cargo fixo, troca de cargo e remoção de acesso.
// O link aparece só uma vez; o banco guarda apenas o hash do código.
export function TeamSettings(){useAppLocale(state=>state.locale)
 const [items,setItems]=useState<TeamMember[]|null>(null),[error,setError]=useState(''),[email,setEmail]=useState(''),[role,setRole]=useState<TeamRole>('support')
 const [busy,setBusy]=useState(''),[link,setLink]=useState(''),[copied,setCopied]=useState(false)
 const load=useCallback(()=>{setError('');teamService.list().then(setItems).catch(reason=>{setItems([]);setError(reason instanceof Error?reason.message:'Não foi possível carregar sua equipe.')})},[])
 useEffect(()=>{load()},[load])
 const run=async(key:string,action:()=>Promise<void>)=>{setBusy(key);setError('');try{await action();load()}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível concluir.')}finally{setBusy('')}}
 const invite=(event:FormEvent)=>{event.preventDefault();setLink('');setCopied(false);void run('invite',async()=>{const token=await teamService.invite(email,role);setLink(teamService.inviteLink(token));setEmail('')})}
 const copy=async()=>{try{await navigator.clipboard.writeText(link);setCopied(true)}catch{setCopied(false)}}
 return <div className="grid gap-4">
  <div className="p-5 rounded-xl border border-[var(--line)]"><b className="flex items-center gap-2"><Users size={16} aria-hidden="true"/><T>Equipe</T></b>
   <p className="muted text-sm mt-2"><T>Convide pessoas para ajudar na sua conta. Cada uma entra com o próprio login e só vê o que o cargo libera. Reembolsos, cobranças, conta de recebimento, verificação, integrações, coprodução e segurança ficam só com você.</T></p>
   <ul className="grid gap-1 mt-3 text-sm">{ROLES.map(item=><li key={item}><b><T>{ROLE_LABEL[item]}</T></b><span className="muted">: <T>{ROLE_DESCRIPTION[item]}</T></span></li>)}</ul>
  </div>
  <form className="p-5 rounded-xl border border-[var(--line)] grid gap-3" onSubmit={invite}>
   <b className="flex items-center gap-2"><UserPlus size={16} aria-hidden="true"/><T>Convidar pessoa</T></b>
   <div className="grid sm:grid-cols-[1fr_200px_auto] gap-3 items-end">
    <label><span className="label"><T>E-mail</T></span><input className="input" type="email" maxLength={254} value={email} onChange={event=>setEmail(event.target.value)} required/></label>
    <label><span className="label"><T>Cargo</T></span><select className="input" value={role} onChange={event=>setRole(event.target.value as TeamRole)}>{ROLES.map(item=><option key={item} value={item}>{uiText(ROLE_LABEL[item])}</option>)}</select></label>
    <button className="btn btn-primary" type="submit" disabled={busy==='invite'||!email.trim()}><UserPlus size={15}/><T>{busy==='invite'?' Criando...':' Criar convite'}</T></button>
   </div>
   {link&&<StateMessage tone="success" title={uiText('Convite criado')}><span><T>Copie o link e envie para a pessoa. Ele vale por 7 dias, funciona uma única vez e só com o e-mail convidado. Por segurança, não aparece de novo.</T></span>
    <div className="flex items-center gap-2 mt-2"><code className="input flex items-center truncate">{link}</code><button type="button" className="btn icon-btn" aria-label={uiText('Copiar link do convite')} onClick={()=>void copy()}>{copied?<Check/>:<Copy/>}</button></div></StateMessage>}
  </form>
  {error&&<StateMessage title={uiText('Atenção')}><span>{error}</span></StateMessage>}
  <div className="rounded-xl border border-[var(--line)]">{items===null?<Loading label="Carregando equipe"/>:items.length===0?<Empty title={uiText('Ninguém na equipe ainda')} text={uiText('Os convites e as pessoas com acesso aparecem aqui.')}/>:
   <div className="table-wrap"><table className="table"><caption className="sr-only"><T>Pessoas da equipe</T></caption><thead><tr><th><T>Pessoa</T></th><th><T>Cargo</T></th><th><T>Situação</T></th><th><span className="sr-only"><T>Ações</T></span></th></tr></thead>
    <tbody>{items.map(item=><tr key={item.id}><td><b>{item.memberName||item.email}</b>{item.memberName&&<p className="muted text-[11px]">{item.email}</p>}</td>
     <td><label className="sr-only" htmlFor={`team-role-${item.id}`}><T>Cargo de </T>{item.email}</label><select id={`team-role-${item.id}`} className="input" value={item.role} disabled={busy===item.id} onChange={event=>void run(item.id,()=>teamService.changeRole(item.id,event.target.value as TeamRole))}>{ROLES.map(value=><option key={value} value={value}>{uiText(ROLE_LABEL[value])}</option>)}</select></td>
     <td><span className="badge"><T>{STATUS_LABEL[item.status]}</T></span><p className="muted text-[11px]">{item.acceptedAt?shortDate(item.acceptedAt):shortDate(item.invitedAt)}</p></td>
     <td><button className="btn" disabled={busy===item.id} onClick={()=>{if(window.confirm(`${uiText('Remover o acesso de')} ${item.email}?`))void run(item.id,()=>teamService.revoke(item.id))}}><UserMinus size={14}/><T>{item.status==='active'?' Remover acesso':' Cancelar convite'}</T></button></td></tr>)}</tbody></table></div>}</div>
 </div>
}
