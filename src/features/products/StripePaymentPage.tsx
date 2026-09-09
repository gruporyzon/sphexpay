import {useEffect,useRef,useState} from 'react'
import {useParams,useSearchParams} from 'react-router-dom'
import {Button,Card,Input} from '../../components/ui'
import {formatCents} from '../../lib/currencyFormat'

type Offer={productName:string;amountCents:number;currency:'BRL'|'USD'|'EUR'}
export default function StripePaymentPage(){
 const {checkoutId=''}=useParams(),[params,setParams]=useSearchParams(),[offer,setOffer]=useState<Offer|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[closed,setClosed]=useState(false)
 const [name,setName]=useState(''),[email,setEmail]=useState(''),requestKey=useRef('')
 useEffect(()=>{let active=true;requestKey.current=sessionStorage.getItem(`stripe-order:${checkoutId}`)||crypto.randomUUID();sessionStorage.setItem(`stripe-order:${checkoutId}`,requestKey.current)
  fetch(`/api/stripe/checkout?checkoutId=${encodeURIComponent(checkoutId)}`).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.message||'Oferta indisponível.');if(active)setOffer(data)}).catch(()=>{if(active)setError('Esta oferta não está disponível para pagamento.')});return()=>{active=false}
 },[checkoutId])
 const pay=async(event:React.FormEvent)=>{event.preventDefault();if(busy)return;setBusy(true);setError('');try{
  const response=await fetch('/api/stripe/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({checkoutId,requestKey:requestKey.current,buyer:{name,email}})})
  const data=await response.json();if(!response.ok){if(data.code==='CHECKOUT_CLOSED')setClosed(true);throw new Error(data.message||'Não foi possível iniciar o pagamento.')}
  const url=new URL(data.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Link de pagamento inválido.')
  window.location.assign(url.toString())
 }catch(e){setError(e instanceof Error?e.message:'Pagamento indisponível.');setBusy(false)}}
 const restart=()=>{requestKey.current=crypto.randomUUID();sessionStorage.setItem(`stripe-order:${checkoutId}`,requestKey.current);setParams({});setError('');setClosed(false)}
 return <main className="stripe-connect-return"><Card><h1>{offer?.productName||'Checkout SphexPay'}</h1>{params.get('result')==='returned'?<><p>Você retornou da Stripe. A confirmação da venda depende do processamento seguro do pagamento.</p><Button onClick={restart}>Iniciar outra compra</Button></>:<>{params.get('result')==='cancelled'&&<p>Pagamento interrompido. Você pode continuar abaixo.</p>}{offer&&<><p>{formatCents(offer.amountCents,offer.currency)}</p><form onSubmit={pay}><label>Nome<Input required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></label><label>E-mail<Input required type="email" maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><Button type="submit" variant="primary" disabled={busy}>{busy?'Abrindo pagamento…':'Pagar com cartão'}</Button></form><p>Os dados do cartão são coletados no ambiente seguro da Stripe.</p></>}</>}{error&&<p role="alert">{error}</p>}{closed&&<Button onClick={restart}>Iniciar outra compra</Button>}</Card></main>
}
