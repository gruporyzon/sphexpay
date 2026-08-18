import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle2, Inbox, LoaderCircle, Search, X } from 'lucide-react'
import { cn } from '../lib/utils'

type ButtonProps=ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'default'|'primary'|'ghost'|'danger';size?:'sm'|'md'|'lg'|'icon'}
export const Button=({className='',variant='default',size='md',type='button',...props}:ButtonProps)=><button type={type} className={cn('btn',variant!=='default'&&`btn-${variant}`,size!=='md'&&`btn-${size}`,className)} {...props}/>

export const Input=({className='',...props}:InputHTMLAttributes<HTMLInputElement>)=><input className={cn('input',className)} {...props}/>
export const Select=({className='',children,...props}:SelectHTMLAttributes<HTMLSelectElement>)=><select className={cn('input select',className)} {...props}>{children}</select>
export const Textarea=({className='',...props}:TextareaHTMLAttributes<HTMLTextAreaElement>)=><textarea className={cn('input textarea',className)} {...props}/>

export const Card=({children,className='',...props}:HTMLAttributes<HTMLDivElement>)=><div className={cn('panel',className)} {...props}>{children}</div>
export const PageTitle=({title,subtitle,action}:{title:string,subtitle:string,action?:ReactNode})=><div className="page-title spx-page-heading"><div><h1>{title}</h1><p className="spx-page-caption">{subtitle}</p></div>{action}</div>
export const SearchBox=({value,onChange,placeholder='Buscar...'}:{value:string,onChange:(v:string)=>void,placeholder?:string})=><label className="search-box"><Search aria-hidden="true"/><span className="sr-only">Pesquisar</span><Input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>{value&&<button onClick={()=>onChange('')} aria-label="Limpar"><X/></button>}</label>

const statusTone=(status:string)=>status==='Aprovado'||status==='Ativo'||status==='Ativa'||status==='Concluído'?'ok':status==='Recusado'||status==='Reembolsado'||status==='Inadimplente'?'bad':status==='Pendente'||status==='Processando'?'warn':'info'
export const Badge=({children,tone='neutral',className='',...props}:HTMLAttributes<HTMLSpanElement>&{tone?:'neutral'|'ok'|'warn'|'bad'|'info'})=><span className={cn('badge',tone!=='neutral'&&`badge-${tone}`,className)} {...props}>{tone!=='neutral'&&<i className="badge-indicator" aria-hidden="true"/>}{children}</span>
export const StatusBadge=({status}:{status:string})=><Badge tone={statusTone(status)}>{status}</Badge>

export const Empty=({text='Nenhum registro encontrado',title='Nada por aqui'}:{text?:string;title?:string})=><div className="empty-state"><span><Inbox/></span><strong>{title}</strong><p>{text}</p></div>
export const Loading=({label='Carregando'}:{label?:string})=><div className="loading-state" role="status"><LoaderCircle/><span>{label}</span></div>
export const Skeleton=({className='',...props}:HTMLAttributes<HTMLDivElement>)=><div className={cn('skeleton',className)} aria-hidden="true" {...props}/>
export const StateMessage=({tone='error',title,children}:HTMLAttributes<HTMLDivElement>&{tone?:'error'|'success';title:string})=><div className={cn('state-message',`state-message-${tone}`)} role={tone==='error'?'alert':'status'}>{tone==='error'?<AlertCircle/>:<CheckCircle2/>}<span><strong>{title}</strong>{children}</span></div>

export const Tooltip=({content,children}:{content:string;children:ReactNode})=><span className="tooltip" data-tooltip={content}>{children}</span>
export const Dropdown=({open,children,align='right',className=''}:{open:boolean;children:ReactNode;align?:'left'|'right';className?:string})=>open?<div className={cn('dropdown',`dropdown-${align}`,className)} role="menu">{children}</div>:null

export const Avatar=({name}:{name:string})=><div className="ui-avatar">{name.split(' ').slice(0,2).map(x=>x[0]).join('')}</div>
export const Modal=({title,children,onClose,className=''}:{title:string;children:ReactNode;onClose:()=>void;className?:string})=>createPortal(<div className="modal-backdrop" onMouseDown={onClose}><section className={cn('modal-surface',className)} role="dialog" aria-modal="true" aria-label={title} onMouseDown={event=>event.stopPropagation()}><header><h2>{title}</h2><Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}><X/></Button></header><div className="modal-content">{children}</div></section></div>,document.body)
