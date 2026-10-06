import {useCallback,useEffect,useState} from 'react'
import {useParams,useSearchParams} from 'react-router-dom'
import {ArrowLeft,LoaderCircle,RotateCcw} from 'lucide-react'
import {checkoutService,type PublishedCheckout} from './checkoutService'
import {CheckoutExperience} from './CheckoutExperience'
import {StripeInlinePayment,StripeCheckoutConfirmation} from './StripeInlinePayment'
import {clearInlineCheckoutAttempt} from './stripeCheckoutClient'

export default function StripePaymentPage(){
 const {checkoutId=''}=useParams(),[params,setParams]=useSearchParams(),[checkout,setCheckout]=useState<PublishedCheckout|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0),[available,setAvailable]=useState(false),[paymentMessage,setPaymentMessage]=useState('Verificando as opções de pagamento…'),[mode,setMode]=useState('')
 useEffect(()=>{let active=true;const controller=new AbortController();setLoading(true);setError('');setCheckout(null);setAvailable(false);setMode('');setPaymentMessage('Verificando as opções de pagamento…')
  if(!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(checkoutId)){setError('Link de checkout inválido. Peça um novo link ao vendedor.');setLoading(false);return}
  checkoutService.getPublished(checkoutId).then(data=>{if(active){setCheckout(data);setLoading(false)}}).catch(()=>{if(active){setError('Este checkout está indisponível, pausado ou não foi publicado. Peça um novo link ao vendedor.');setLoading(false)}})
  fetch(`/api/stripe/checkout?checkoutId=${encodeURIComponent(checkoutId)}`,{signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.message||'Pagamento temporariamente indisponível.');if(active){setAvailable(data.paymentAvailable===true&&data.embeddedAvailable===true);setMode(data.mode||'');setPaymentMessage(data.paymentMessage||'O vendedor ainda não habilitou o pagamento desta oferta.')}}).catch(()=>{if(active)setPaymentMessage('O pagamento desta oferta está temporariamente indisponível. Entre em contato com o vendedor.')})
  return()=>{active=false;controller.abort()}
 },[checkoutId,retry])
 const complete=useCallback((sessionId:string)=>setParams({result:'returned',session_id:sessionId}),[setParams])
 const restart=()=>{clearInlineCheckoutAttempt(checkoutId,mode);setParams({})}
 if(loading)return <main className="co-loading" aria-busy="true"><LoaderCircle className="spin"/><h1>Preparando seu checkout</h1><p>Buscando a oferta e suas informações.</p></main>
 if(error||!checkout)return <main className="co-unavailable"><h1>Checkout indisponível</h1><p role="alert">{error}</p><button className="btn" onClick={()=>setRetry(n=>n+1)}><RotateCcw/>Tentar novamente</button><a href="/"><ArrowLeft/>Conhecer a SphexPay</a></main>
 return <>{mode==='test'&&<div className="co-test-mode" role="status">AMBIENTE DE TESTE · ESTE CHECKOUT NÃO REALIZA COBRANÇAS DE PRODUÇÃO</div>}<CheckoutExperience key={`${checkoutId}:${checkout.version.number}:${params.get('result')||'purchase'}`} product={checkout.product} price={checkout.offer.priceCents} currency={checkout.offer.currency} layout={checkout.version.layout} design={checkout.version.design} settings={checkout.version.settings} paymentAvailable={available} paymentMessage={paymentMessage} renderPayment={available?(buyer,render)=><StripeInlinePayment checkoutId={checkoutId} buyer={buyer} mode={mode} price={checkout.offer.priceCents} currency={checkout.offer.currency} design={checkout.version.design} render={render} onComplete={complete}/>:undefined} confirmationContent={<StripeCheckoutConfirmation checkoutId={checkoutId} sessionId={params.get('session_id')}/>} returned={params.get('result')==='returned'} cancelled={params.get('result')==='cancelled'} onRestart={restart}/></>
}
