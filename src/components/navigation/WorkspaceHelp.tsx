import {useEffect,useRef,useState} from 'react'
import {Link,useLocation} from 'react-router-dom'
import {ArrowRight,MessageCircle,X} from 'lucide-react'

export function WorkspaceHelp(){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),close=useRef<HTMLButtonElement>(null),{pathname}=useLocation()
 const prefix=pathname.startsWith('/dev/workspace-preview')?'/dev/workspace-preview':'/app'
 useEffect(()=>setOpen(false),[pathname])
 useEffect(()=>{if(!open)return;close.current?.focus();const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);trigger.current?.focus()}};const pointer=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};addEventListener('keydown',key);addEventListener('pointerdown',pointer);return()=>{removeEventListener('keydown',key);removeEventListener('pointerdown',pointer)}},[open])
 return <div className="reference-help" ref={root}>{open&&<section role="dialog" aria-label="Ajuda SphexPay" className="reference-help-panel"><header><h2>Como podemos ajudar?</h2><button ref={close} type="button" aria-label="Fechar ajuda" onClick={()=>{setOpen(false);trigger.current?.focus()}}><X/></button></header><p>Encontre o que precisa para acompanhar sua operação.</p><Link to={`${prefix}/financeiro`}>Conectar meus pagamentos<ArrowRight/></Link><Link to={`${prefix}/produtos`}>Gerenciar produtos e checkouts<ArrowRight/></Link><Link to={`${prefix}/configuracoes`}>Configurações da minha conta<ArrowRight/></Link></section>}<button ref={trigger} type="button" className="reference-help-trigger" aria-label={open?'Fechar ajuda':'Abrir ajuda'} aria-expanded={open} aria-haspopup="dialog" onClick={()=>setOpen(value=>!value)}>{open?<X/>:<MessageCircle/>}</button></div>
}
