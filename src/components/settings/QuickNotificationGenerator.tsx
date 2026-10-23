import { useCallback,useEffect,useMemo,useRef,useState } from 'react'
import { BellRing,Send,Shuffle,Square } from 'lucide-react'
import { T,translate as uiText } from '../../i18n'
import { useAppLocale } from '../../i18n/localeStore'
import { pushSubscriptionService,type PushDevice } from '../../services/pushSubscriptionService'

// Gerador rápido: avisos no padrão dos gateways ("Venda aprovada!" / "Valor: R$ 197,00") com
// valores automáticos realistas, em sequência com ritmo natural. Chegam no celular e no
// computador conectados como as notificações de venda. Envio pelo mesmo canal do gerador manual.
type Kind='sale_approved'|'sale_pending'|'pix_paid'|'subscription_renewed'|'withdrawal_completed'
const KINDS:{id:Kind;label:string;title:string}[]=[
 {id:'sale_approved',label:'Venda aprovada',title:'Venda aprovada!'},
 {id:'pix_paid',label:'Pix pago',title:'Pix pago!'},
 {id:'sale_pending',label:'Venda pendente',title:'Venda pendente'},
 {id:'subscription_renewed',label:'Assinatura',title:'Assinatura renovada!'},
 {id:'withdrawal_completed',label:'Saque',title:'Saque concluído'}
]
const QUANTITIES=[1,5,10,25] as const
type Pace='natural'|'fast'|'minute'
const PACES:{id:Pace;label:string;hint:string}[]=[{id:'natural',label:'Natural',hint:'15 a 75 s, como vendas reais'},{id:'fast',label:'Rápido',hint:'a cada 8 s'},{id:'minute',label:'1 por minuto',hint:'a cada 60 s'}]
// Preços comuns de infoprodutos e SaaS; às vezes com centavos, como num checkout real.
const TICKETS=[27,37,47,67,97,97,127,147,197,197,247,297,397,497,997]
const PLANS=[29.9,49.9,97,147,197]

const random=(max:number)=>Math.floor(Math.random()*max)
export function smartAmountCents(kind:Kind,pick=random){
 if(kind==='withdrawal_completed')return(1000+pick(24000))*100+pick(100)
 if(kind==='subscription_renewed')return Math.round(PLANS[pick(PLANS.length)]*100)
 const base=TICKETS[pick(TICKETS.length)]*100
 return pick(100)<15?base-10:base
}
const brl=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100)
const parseMoney=(raw:string)=>{const value=Number(raw.replace(/\./g,'').replace(',','.'));return Number.isFinite(value)&&value>0?Math.round(value*100):0}
const delayFor=(pace:Pace)=>pace==='fast'?8000:pace==='minute'?60000:15000+random(60000)

export function QuickNotificationGenerator(){useAppLocale(state=>state.locale)
 const [kind,setKind]=useState<Kind>('sale_approved'),[auto,setAuto]=useState(true),[fixed,setFixed]=useState('197,00'),[quantity,setQuantity]=useState<number>(5),[pace,setPace]=useState<Pace>('natural')
 const [devices,setDevices]=useState<PushDevice[]|null>(null),[connecting,setConnecting]=useState(false),[running,setRunning]=useState(false),[sent,setSent]=useState(0),[message,setMessage]=useState(''),[preview,setPreview]=useState(()=>smartAmountCents('sale_approved'))
 const stopRef=useRef(false),timer=useRef<number|undefined>(undefined)
 const loadDevices=useCallback(()=>pushSubscriptionService.devices().then(list=>setDevices(list.filter(device=>device.enabled&&(device.status==='Conectado'||device.status==='Ativo')))).catch(()=>setDevices([])),[])
 useEffect(()=>{void loadDevices();return()=>{stopRef.current=true;if(timer.current)clearTimeout(timer.current)}},[loadDevices])
 useEffect(()=>{setPreview(smartAmountCents(kind))},[kind])
 const title=KINDS.find(item=>item.id===kind)!.title
 const amount=auto?preview:parseMoney(fixed)
 const ready=Boolean(devices?.length)&&amount>0&&!running
 const connect=async()=>{setConnecting(true);setMessage('');const result=await pushSubscriptionService.subscribe().catch(()=>null);setConnecting(false);if(!result?.ok){setMessage(result?.message||'Não foi possível ativar as notificações neste aparelho.');return}await loadDevices()}
 const stop=()=>{stopRef.current=true;if(timer.current)clearTimeout(timer.current);setRunning(false)}
 const start=async()=>{
  const ids=(devices||[]).map(device=>device.deviceId)
  if(!ids.length)return
  stopRef.current=false;setRunning(true);setSent(0);setMessage('')
  for(let index=0;index<quantity;index++){
   if(stopRef.current)break
   const cents=auto?(index===0?preview:smartAmountCents(kind)):amount
   const result=await pushSubscriptionService.sendManual({notificationType:kind,title,body:`Valor: ${brl(cents)}`,route:kind==='withdrawal_completed'?'/app/financeiro/saques':'/app/vendas',icon:'/icons/sphexpay-app-192.png',deviceIds:ids,currency:'BRL'}).catch(()=>({ok:false,message:''}))
   if(!result.ok){setMessage(result.message||'O envio falhou. Confira se este aparelho continua conectado.');break}
   setSent(index+1)
   if(index<quantity-1&&!stopRef.current)await new Promise<void>(resolve=>{timer.current=window.setTimeout(resolve,delayFor(pace))})
  }
  setRunning(false);if(auto)setPreview(smartAmountCents(kind))
 }
 const paceHint=useMemo(()=>PACES.find(item=>item.id===pace)!.hint,[pace])
 return <section className="quick-push" aria-labelledby="quick-push-title">
  <header className="quick-push-head"><BellRing aria-hidden="true"/><div><h3 id="quick-push-title"><T>Gerador rápido</T></h3><p><T>Avisos no padrão dos gateways, com valores automáticos. Chegam nos aparelhos conectados.</T></p></div></header>
  <div className="quick-push-body">
   <div className="quick-push-controls">
    <div className="quick-push-row" role="radiogroup" aria-label={uiText('Tipo de aviso')}>{KINDS.map(item=><button key={item.id} type="button" role="radio" aria-checked={kind===item.id} disabled={running} onClick={()=>setKind(item.id)}><T>{item.label}</T></button>)}</div>
    <div className="quick-push-field"><span><T>Valor</T></span><div className="quick-push-row">
     <button type="button" aria-pressed={auto} disabled={running} onClick={()=>setAuto(true)}><Shuffle size={13} aria-hidden="true"/><T> Automático</T></button>
     <button type="button" aria-pressed={!auto} disabled={running} onClick={()=>setAuto(false)}><T>Fixo</T></button>
     {!auto&&<label className="quick-push-money"><span>R$</span><input className="input" inputMode="decimal" aria-label={uiText('Valor fixo')} value={fixed} disabled={running} onChange={event=>setFixed(event.target.value.replace(/[^\d.,]/g,''))}/></label>}
    </div></div>
    <div className="quick-push-field"><span><T>Quantidade</T></span><div className="quick-push-row">{QUANTITIES.map(value=><button key={value} type="button" aria-pressed={quantity===value} disabled={running} onClick={()=>setQuantity(value)}>{value}</button>)}</div></div>
    {quantity>1&&<div className="quick-push-field"><span><T>Ritmo</T></span><div className="quick-push-row">{PACES.map(item=><button key={item.id} type="button" aria-pressed={pace===item.id} disabled={running} onClick={()=>setPace(item.id)}><T>{item.label}</T></button>)}</div><small><T>{paceHint}</T></small></div>}
   </div>
   <div className="quick-push-side">
    <article className="quick-push-preview" aria-label={uiText('Prévia da notificação')}><img src="/icons/sphexpay-app-192.png" alt="" width={32} height={32}/><div><b>{title}</b><p>{amount>0?`Valor: ${brl(amount)}`:uiText('Informe um valor')}</p></div><small><T>agora</T></small></article>
    {devices!==null&&!devices.length?<button type="button" className="btn" disabled={connecting} onClick={()=>void connect()}><BellRing size={15}/><T>{connecting?' Ativando...':' Ativar notificações neste aparelho'}</T></button>
     :running?<button type="button" className="btn" onClick={stop}><Square size={15}/>{` ${uiText('Parar')} · ${sent}/${quantity}`}</button>
     :<button type="button" className="btn btn-primary" disabled={!ready} onClick={()=>void start()}><Send size={15}/><T>{quantity===1?' Enviar agora':' Enviar sequência'}</T></button>}
    <p className="quick-push-status" aria-live="polite">{message?<span className="quick-push-error">{message}</span>:running?<T>Enviando. Mantenha esta página aberta.</T>:sent?`${sent} ${uiText(sent===1?'aviso enviado':'avisos enviados')}`:devices?.length?`${devices.length} ${uiText(devices.length===1?'aparelho conectado':'aparelhos conectados')}`:''}</p>
   </div>
  </div>
 </section>
}
