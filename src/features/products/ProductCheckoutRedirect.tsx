import { useEffect,useState } from 'react'
import { Navigate,useLocation,useParams } from 'react-router-dom'
import { ArrowLeft,LoaderCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import './checkout-experience.css'

const UUID=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

// Link de campanha /p/{produto}: abre o checkout padrão publicado preservando UTMs e demais parâmetros.
export default function ProductCheckoutRedirect(){
 const {productId=''}=useParams(),{search}=useLocation()
 const [target,setTarget]=useState<string|null>(null),[failed,setFailed]=useState(false)
 useEffect(()=>{
  let active=true
  if(!UUID.test(productId)||!supabase){setFailed(true);return}
  supabase.rpc('get_product_checkout_link',{p_product_id:productId})
   .then(({data,error})=>{if(!active)return;if(error||typeof data!=='string'||!UUID.test(data))setFailed(true);else setTarget(data)},()=>{if(active)setFailed(true)})
  return()=>{active=false}
 },[productId])
 if(target)return <Navigate to={`/pay/${target}${search}`} replace/>
 if(failed)return <main className="co-unavailable"><h1>Checkout indisponível</h1><p role="alert">Este produto não tem um checkout publicado no momento. Peça um novo link ao vendedor.</p><a href="/"><ArrowLeft/>Conhecer a SphexPay</a></main>
 return <main className="co-loading" aria-busy="true"><LoaderCircle className="spin"/><h1>Abrindo o checkout</h1><p>Buscando a oferta deste produto.</p></main>
}
