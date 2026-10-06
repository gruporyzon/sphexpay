import {useEffect,useMemo,useState} from 'react'
import type {ReactNode} from 'react'
import {CheckoutElementsProvider,PaymentElement,useCheckoutElements} from '@stripe/react-stripe-js/checkout'
import type {Stripe} from '@stripe/stripe-js'
import {ArrowRight,LoaderCircle,RotateCcw} from 'lucide-react'
import type {CheckoutBuyer,CheckoutPaymentParts} from './CheckoutExperience'
import type {CheckoutDesign} from './checkoutService'
import {reserveInlineCheckout,paymentClient} from './stripeCheckoutClient'
import type {Session} from './stripeCheckoutClient'

type Props={checkoutId:string;buyer:CheckoutBuyer;mode:string;price:number;currency:string;design:CheckoutDesign;render:(parts:CheckoutPaymentParts)=>ReactNode;onComplete:(sessionId:string)=>void}
export function StripeInlinePayment({checkoutId,buyer,mode,price,currency,design,render,onComplete}:Props){
 const [session,setSession]=useState<Session|null>(null),[stripe,setStripe]=useState<Stripe|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 useEffect(()=>{
  let active=true;setSession(null);setError('')
  reserveInlineCheckout(checkoutId,{name:buyer.name,email:buyer.email},mode).then(async data=>{
   if(!active)return
   if(data.completed){onComplete(data.sessionId);return}
   if(data.amountCents!==price||data.currency!==currency)throw new Error('O valor da oferta foi alterado. Atualize a página para revisar antes de pagar.')
   const client=await paymentClient(data)
   if(!client)throw new Error('Não foi possível carregar a Stripe. Tente novamente.')
   if(active){setStripe(client);setSession(data)}
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Não foi possível carregar o pagamento.')})
  return()=>{active=false}
 },[checkoutId,buyer.name,buyer.email,mode,price,currency,retry,onComplete])
 const options=useMemo(()=>session?{clientSecret:session.clientSecret,elementsOptions:{appearance:{theme:design.text==='#f8fafc'||design.text==='#f5f5f5'?'night' as const:'stripe' as const,variables:{colorPrimary:design.primary,colorBackground:design.card,colorText:design.text,fontFamily:'Inter, system-ui, sans-serif',borderRadius:`${Math.min(16,Math.max(0,design.radius))}px`}}}}:null,[session,design.primary,design.card,design.text,design.radius])
 if(!session||!options||!stripe)return render({fields:<div className="co-stripe-state" role={error?'alert':'status'}>{error?<><p>{error}</p><button type="button" className="co-stripe-retry" onClick={()=>setRetry(n=>n+1)}><RotateCcw/> Tentar novamente</button></>:<><LoaderCircle className="spin"/><p>Preparando o formulário seguro…</p></>}</div>,action:<button type="button" className={`co-action co-action-${design.buttonStyle} co-action-shape-${design.buttonShape||'rounded'}`} disabled>Preparando pagamento…</button>})
 return <CheckoutElementsProvider stripe={stripe} options={options}><StripePaymentFields render={render} sessionId={session.sessionId} design={design} onComplete={onComplete}/></CheckoutElementsProvider>
}
export function StripePaymentFields({render,sessionId,design,onComplete}:{render:Props['render'];sessionId:string;design:CheckoutDesign;onComplete:Props['onComplete']}){
 const state=useCheckoutElements(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loadFailed,setLoadFailed]=useState(false)
 const confirm=async()=>{
  if(state.type!=='success'||busy||loadFailed)return
  setBusy(true);setError('')
  try{const result=await state.checkout.confirm({redirect:'if_required'});if(result.type==='error'){setError(result.error.message);setBusy(false)}else onComplete(sessionId)}
  catch{setError('Não foi possível concluir o pagamento. Confira a conexão e tente novamente.');setBusy(false)}
 }
 const unavailable=state.type==='error'?state.error.message:loadFailed?'Não foi possível carregar os campos seguros. Atualize a página para tentar novamente.':''
 return render({locked:busy,fields:<div className="co-stripe-fields">{state.type==='loading'?<p className="co-stripe-state" role="status"><LoaderCircle className="spin"/> Carregando campos seguros…</p>:unavailable?<p className="co-alert co-alert-error" role="alert">{unavailable}</p>:<PaymentElement options={{layout:'tabs'}} onLoadError={()=>setLoadFailed(true)}/>}<p className="co-caption">Seus dados de cartão são enviados diretamente à Stripe.</p>{error&&<p className="co-alert co-alert-error" role="alert">{error}</p>}</div>,action:<button className={`co-action co-action-${design.buttonStyle} co-action-shape-${design.buttonShape||'rounded'}`} type="button" disabled={busy||state.type!=='success'||loadFailed||!state.checkout.canConfirm} onClick={()=>void confirm()}>{busy?<><LoaderCircle className="spin"/>Processando pagamento…</>:<>Pagar com segurança<ArrowRight/></>}</button>})
}

export function StripeCheckoutConfirmation({checkoutId,sessionId}:{checkoutId:string;sessionId:string|null}){
 const [status,setStatus]=useState('loading'),[recorded,setRecorded]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 useEffect(()=>{
  let active=true,timer:ReturnType<typeof setTimeout>|undefined,attempts=0
  const controller=new AbortController();setStatus('loading');setError('');setRecorded(false)
  if(!sessionId){setStatus('unknown');return()=>controller.abort()}
  const check=async()=>{
   try{
    const response=await fetch(`/api/stripe/checkout?checkoutId=${encodeURIComponent(checkoutId)}&sessionId=${encodeURIComponent(sessionId)}`,{signal:controller.signal}),data=await response.json()
    if(!response.ok)throw new Error(data.message||'Não foi possível verificar o pagamento agora.')
    if(!['paid','pending','expired','refunded'].includes(data.status))throw new Error('O pagamento ainda não pôde ser verificado.')
    if(!active)return;setStatus(data.status);setRecorded(data.recorded===true);attempts++
    if((data.status==='pending'||data.status==='paid'&&!data.recorded)&&attempts<15)timer=setTimeout(()=>void check(),2000)
   }catch(e){if(active){setStatus('unknown');setError(e instanceof Error?e.message:'Não foi possível verificar o pagamento.')}}
  }
  void check();return()=>{active=false;controller.abort();if(timer)clearTimeout(timer)}
 },[checkoutId,sessionId,retry])
 const title=status==='paid'?(recorded?'Pagamento confirmado':'Pagamento recebido'):status==='refunded'?'Pagamento reembolsado':status==='expired'?'Tentativa expirada':status==='loading'?'Verificando pagamento':'Pagamento em verificação'
 const message=status==='paid'?(recorded?'Sua compra foi confirmada e registrada com segurança.':'O processador recebeu o pagamento. Estamos aguardando o registro da confirmação.'):status==='refunded'?'O processador informou o reembolso deste pagamento.':status==='expired'?'Esta sessão expirou. Você pode iniciar uma nova compra.':status==='pending'?'O pagamento ainda não foi confirmado pelo processador.':error||'Aguarde enquanto verificamos o resultado. Retornar à página não confirma uma cobrança.'
 return <div role="status" aria-live="polite"><h2>{title}</h2><p>{message}</p>{status==='unknown'||status==='pending'||status==='paid'&&!recorded?<button type="button" className="co-stripe-retry" onClick={()=>setRetry(n=>n+1)}><RotateCcw/>Verificar novamente</button>:null}</div>
}
