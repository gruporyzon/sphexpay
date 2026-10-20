import { useId,useState,type CSSProperties,type InputHTMLAttributes,type MouseEvent,type PropsWithChildren,type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle,ArrowLeft,CheckCircle2,Eye,EyeOff } from 'lucide-react'
import './signupFlow.css'

export function FlowShell({children,complete=false,back}:PropsWithChildren<{complete?:boolean;back?:{to:string;label:string}}>){
 return <main className={`spx-flow${complete?' is-complete':''}`}>
  <div className="spx-flow-aura" aria-hidden="true"/>
  {back&&<Link className="spx-flow-back" to={back.to}><ArrowLeft aria-hidden="true"/>{back.label}</Link>}
  <div className="spx-flow-main">
   <Link to="/" className="spx-flow-brand" aria-label="SphexPay — página inicial"><img src="/brand/sphex-symbol-mask.png" alt="" width="28" height="36"/><span>Sphex<b>Pay</b></span></Link>
   {children}
  </div>
 </main>
}

type FieldProps=Omit<InputHTMLAttributes<HTMLInputElement>,'onChange'>&{label:string;onChange:(value:string)=>void;index?:number;invalid?:boolean}

function FieldBox({label,index,invalid,required,toggle,children,inputId}:PropsWithChildren<{label:string;index:number;invalid:boolean;required?:boolean;toggle?:ReactNode;inputId:string}>){
 const focus=(event:MouseEvent<HTMLDivElement>)=>{if(!(event.target as HTMLElement).closest('button,input'))document.getElementById(inputId)?.focus()}
 return <div className={`spx-flow-field${toggle?' has-toggle':''}${invalid?' is-invalid':''}`} style={{'--i':index} as CSSProperties} onClick={focus}>
  <span><label htmlFor={inputId}>{label}</label>{required&&<i aria-hidden="true">*</i>}</span>
  {children}{toggle}
 </div>
}

export function FlowField({label,onChange,index=0,invalid=false,required,id,...input}:FieldProps){
 const generated=useId(),inputId=id??generated
 return <FieldBox label={label} index={index} invalid={invalid} required={required} inputId={inputId}>
  <input {...input} id={inputId} required={required} aria-invalid={invalid||undefined} onChange={event=>onChange(event.target.value)}/>
 </FieldBox>
}

export function FlowPasswordField({label,onChange,index=0,invalid=false,required,id,...input}:FieldProps){
 const [visible,setVisible]=useState(false),generated=useId(),inputId=id??generated
 const toggle=<button type="button" className="spx-flow-eye" aria-label={visible?`Ocultar ${label.toLowerCase()}`:`Mostrar ${label.toLowerCase()}`} aria-pressed={visible} aria-controls={inputId} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff/>:<Eye/>}</button>
 return <FieldBox label={label} index={index} invalid={invalid} required={required} inputId={inputId} toggle={toggle}>
  <input {...input} id={inputId} type={visible?'text':'password'} required={required} aria-invalid={invalid||undefined} onChange={event=>onChange(event.target.value)}/>
 </FieldBox>
}

export function FlowNotice({message,success=false}:{message:string;success?:boolean}){
 if(!message)return null
 return <div key={message} className={`spx-flow-notice${success?' success':''}`} role={success?'status':'alert'}>{success?<CheckCircle2 aria-hidden="true"/>:<AlertCircle aria-hidden="true"/>}<span>{message}</span></div>
}
