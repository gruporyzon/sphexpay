import {useEffect,useRef,useState} from 'react'
import {useParams,useSearchParams} from 'react-router-dom'
import {ArrowLeft,LoaderCircle,RotateCcw} from 'lucide-react'
import {checkoutService,type PublishedCheckout} from './checkoutService'
import {CheckoutExperience,type CheckoutBuyer} from './CheckoutExperience'

function readSession(key:string){try{return sessionStorage.getItem(key)}catch{return null}}
function writeSession(key:string,value:string){try{sessionStorage.setItem(key,value)}catch{/* Private browsers can reject storage. In-memory retries still work. */}}
export default function StripePaymentPage(){
 const {checkoutId=''}=useParams(),[params,setParams]=useSearchParams(),[checkout,setCheckout]=useState<PublishedCheckout|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0),[available,setAvailable]=useState(false),[paymentMessage,setPaymentMessage]=useState('Verificando as opções de pagamento…'),[mode,setMode]=useState('')
 const request=useRef<{key:string;signature:string}|null>(null)
 useEffect(()=>{let active=true;const controller=new AbortController();setLoading(true);setError('');setCheckout(null);setAvailable(false);setMode('');setPaymentMessage('Verificando as opções de pagamento…');request.current=null
  if(!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(checkoutId)){setError('Link de checkout inválido. Peça um novo link ao vendedor.');setLoading(false);return}
  checkoutService.getPublished(checkoutId).then(data=>{if(active){setCheckout(data);setLoading(false)}}).catch(()=>{if(active){setError('Este checkout está indisponível, pausado ou não foi publicado. Peça um novo link ao vendedor.');setLoading(false)}})
  fetch(`/api/stripe/checkout?checkoutId=${encodeURIComponent(checkoutId)}`,{signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.message||'Pagamento temporariamente indisponível.');if(active){setAvailable(data.paymentAvailable===true);setMode(data.mode||'');setPaymentMessage(data.paymentMessage||'O vendedor ainda não habilitou o pagamento desta oferta.')}}).catch(()=>{if(active)setPaymentMessage('O pagamento desta oferta está temporariamente indisponível. Entre em contato com o vendedor.')})
  return()=>{active=false;controller.abort()}
 },[checkoutId,retry])
 const pay=async(buyer:CheckoutBuyer)=>{
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(buyer))),signature=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join(''),storageKey=`stripe-attempt:${checkoutId}`
  if(!request.current){try{const saved=JSON.parse(readSession(storageKey)||'null');if(saved?.signature===signature&&/^[\da-f-]{36}$/i.test(saved.key))request.current=saved}catch{/* Ignore stale data. */}}
  if(!request.current||request.current.signature!==signature)request.current={key:crypto.randomUUID(),signature}
  writeSession(storageKey,JSON.stringify(request.current))
  const response=await fetch('/api/stripe/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({checkoutId,requestKey:request.current.key,buyer})})
  const data=await response.json();if(!response.ok){if(data.code==='CHECKOUT_CLOSED'){request.current=null;writeSession(storageKey,'null')}throw new Error(data.message||'Não foi possível iniciar o pagamento. Tente novamente.')}
  const url=new URL(data.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('O processador retornou um link de pagamento inválido.')
  window.location.assign(url.toString())
 }
 const restart=()=>{request.current=null;writeSession(`stripe-attempt:${checkoutId}`,'null');setParams({})}
 if(loading)return <main className="co-loading" aria-busy="true"><LoaderCircle className="spin"/><h1>Preparando seu checkout</h1><p>Buscando a oferta e suas informações.</p></main>
 if(error||!checkout)return <main className="co-unavailable"><h1>Checkout indisponível</h1><p role="alert">{error}</p><button className="btn" onClick={()=>setRetry(n=>n+1)}><RotateCcw/>Tentar novamente</button><a href="/"><ArrowLeft/>Conhecer a SphexPay</a></main>
 return <>{mode==='test'&&<div className="co-test-mode" role="status">AMBIENTE DE TESTE · ESTE CHECKOUT NÃO REALIZA COBRANÇAS DE PRODUÇÃO</div>}<CheckoutExperience key={`${checkoutId}:${checkout.version.number}:${params.get('result')||'purchase'}`} product={checkout.product} price={checkout.offer.priceCents} currency={checkout.offer.currency} layout={checkout.version.layout} design={checkout.version.design} settings={checkout.version.settings} paymentAvailable={available} paymentMessage={paymentMessage} onPay={pay} returned={params.get('result')==='returned'} cancelled={params.get('result')==='cancelled'} onRestart={restart}/></>
}
