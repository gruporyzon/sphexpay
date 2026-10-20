import {T,useTranslation} from '../../i18n'
import {useEffect,useRef,useState} from 'react'
import {Link,useLocation} from 'react-router-dom'
import {ArrowRight,MessageCircle,X} from 'lucide-react'
import {SearchInput} from '../common/SearchInput'

export function WorkspaceHelp(){
 const {t}=useTranslation()

 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),close=useRef<HTMLButtonElement>(null),{pathname}=useLocation()
 const prefix=pathname.startsWith('/dev/workspace-preview')?'/dev/workspace-preview':'/app'
 useEffect(()=>setOpen(false),[pathname])
 useEffect(()=>{const shortcut=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setOpen(true);requestAnimationFrame(()=>root.current?.querySelector<HTMLInputElement>('input[type=search]')?.focus())}};addEventListener('keydown',shortcut);return()=>removeEventListener('keydown',shortcut)},[])
 useEffect(()=>{if(!open)return;close.current?.focus();const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);trigger.current?.focus()}};const pointer=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};addEventListener('keydown',key);addEventListener('pointerdown',pointer);return()=>{removeEventListener('keydown',key);removeEventListener('pointerdown',pointer)}},[open])
 return <div className="reference-help" ref={root}><section hidden={!open} role="dialog" aria-label={t('Ajuda SphexPay')} className="reference-help-panel"><header><h2><T>Como podemos ajudar?</T></h2><button ref={close} type="button" aria-label={t('Fechar ajuda')} onClick={()=>{setOpen(false);trigger.current?.focus()}}><X/></button></header><p><T>Encontre o que precisa para acompanhar sua operação.</T></p><SearchInput navigationRoot={prefix}/><Link to={`${prefix}/financeiro`}><T>Conectar meus pagamentos</T><ArrowRight/></Link><Link to={`${prefix}/produtos`}><T>Gerenciar produtos e checkouts</T><ArrowRight/></Link><Link to={`${prefix}/configuracoes`}><T>Configurações da minha conta</T><ArrowRight/></Link></section><button ref={trigger} type="button" className="reference-help-trigger" aria-label={t(open?'Fechar ajuda':'Abrir ajuda')} aria-expanded={open} aria-haspopup="dialog" onClick={()=>setOpen(value=>!value)}>{open?<X/>:<MessageCircle/>}</button></div>
}
