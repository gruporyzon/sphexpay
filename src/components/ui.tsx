import {translate as uiText} from '../i18n'
import {useAppLocale} from '../i18n/localeStore'
import {T,useTranslation} from '../i18n'
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
export const Button=({className='',variant='default',size='md',type='button',...props}:ButtonProps)=>{useAppLocale(state=>state.locale);return (<button type={type} className={cn('btn',variant!=='default'&&`btn-${variant}`,size!=='md'&&`btn-${size}`,className)} {...props}/>);}

export const Input=({className='',...props}:InputHTMLAttributes<HTMLInputElement>)=>{const {t}=useTranslation();return <input className={cn('input',className)} {...props} placeholder={props.placeholder?t(props.placeholder):undefined} aria-label={props['aria-label']?t(props['aria-label']):undefined}/>}
export const Select=({className='',children,...props}:SelectHTMLAttributes<HTMLSelectElement>)=>{useAppLocale(state=>state.locale);return (<select className={cn('input select',className)} {...props}>{children}</select>);}
export const Textarea=({className='',...props}:TextareaHTMLAttributes<HTMLTextAreaElement>)=>{useAppLocale(state=>state.locale);return (<textarea className={cn('input textarea',className)} {...props}/>);}

export const Card=({children,className='',...props}:HTMLAttributes<HTMLDivElement>)=>{useAppLocale(state=>state.locale);return (<div className={cn('panel',className)} {...props}>{children}</div>);}
export const PageTitle=({title,subtitle,action}:{title:string,subtitle:string,action?:ReactNode})=>{const {t}=useTranslation();return <div className="page-title spx-page-heading"><div><h1>{t(title)}</h1><p className="spx-page-caption">{t(subtitle)}</p></div>{action}</div>}
export const SearchBox=({value,onChange,placeholder='Buscar...'}:{value:string,onChange:(v:string)=>void,placeholder?:string})=>{useAppLocale(state=>state.locale);return (<label className="search-box"><Search aria-hidden="true"/><span className="sr-only"><T>Pesquisar</T></span><Input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>{value&&<button onClick={()=>onChange('')} aria-label={uiText("Limpar")}><X/></button>}</label>);}

const statusTone=(status:string)=>status==='Aprovado'||status==='Ativo'||status==='Ativa'||status==='Concluído'?'ok':status==='Recusado'||status==='Reembolsado'||status==='Inadimplente'?'bad':status==='Pendente'||status==='Processando'?'warn':'info'
export const Badge=({children,tone='neutral',className='',...props}:HTMLAttributes<HTMLSpanElement>&{tone?:'neutral'|'ok'|'warn'|'bad'|'info'})=>{useAppLocale(state=>state.locale);return (<span className={cn('badge',tone!=='neutral'&&`badge-${tone}`,className)} {...props}>{tone!=='neutral'&&<i className="badge-indicator" aria-hidden="true"/>}{children}</span>);}
export const StatusBadge=({status}:{status:string})=>{const {t}=useTranslation();return <Badge tone={statusTone(status)}>{t(status)}</Badge>}

export const Empty=({text='Nenhum registro encontrado',title='Nada por aqui'}:{text?:string;title?:string})=>{const {t}=useTranslation();return <div className="empty-state"><span><Inbox/></span><strong>{t(title)}</strong><p>{t(text)}</p></div>}
export const Loading=({label='Carregando'}:{label?:string})=>{const {t}=useTranslation();return <div className="loading-state" role="status"><LoaderCircle/><span>{t(label)}</span></div>}
export const Skeleton=({className='',...props}:HTMLAttributes<HTMLDivElement>)=>{useAppLocale(state=>state.locale);return (<div className={cn('skeleton',className)} aria-hidden="true" {...props}/>);}
export const StateMessage=({tone='error',title,children}:HTMLAttributes<HTMLDivElement>&{tone?:'error'|'success';title:string})=>{useAppLocale(state=>state.locale);return (<div className={cn('state-message',`state-message-${tone}`)} role={tone==='error'?'alert':'status'}>{tone==='error'?<AlertCircle/>:<CheckCircle2/>}<span><strong>{title}</strong>{children}</span></div>);}

export const Tooltip=({content,children}:{content:string;children:ReactNode})=>{useAppLocale(state=>state.locale);return (<span className="tooltip" data-tooltip={content}>{children}</span>);}
export const Dropdown=({open,children,align='right',className=''}:{open:boolean;children:ReactNode;align?:'left'|'right';className?:string})=>{useAppLocale(state=>state.locale);return (open?<div className={cn('dropdown',`dropdown-${align}`,className)} role="menu">{children}</div>:null);}

export const Avatar=({name}:{name:string})=>{useAppLocale(state=>state.locale);return (<div className="ui-avatar">{name.split(' ').slice(0,2).map(x=>x[0]).join('')}</div>);}
export const Modal=({title,children,onClose,className=''}:{title:string;children:ReactNode;onClose:()=>void;className?:string})=>{useAppLocale(state=>state.locale);return (createPortal(<div className="modal-backdrop" onMouseDown={onClose}><section className={cn('modal-surface',className)} role="dialog" aria-modal="true" aria-label={title} onMouseDown={event=>event.stopPropagation()}><header><h2>{title}</h2><Button variant="ghost" size="icon" aria-label={uiText("Fechar")} onClick={onClose}><X/></Button></header><div className="modal-content">{children}</div></section></div>,document.body));}
