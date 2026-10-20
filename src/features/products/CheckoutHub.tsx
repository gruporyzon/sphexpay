import {T} from '../../i18n'
import {useEffect,useState} from 'react'
import {Link,useParams} from 'react-router-dom'
import {ArrowRight,LayoutTemplate,LoaderCircle,Package,Video} from 'lucide-react'
import {productServiceV2} from './productServiceV2'
import {ProductCheckoutsPage} from './CheckoutStudio'
import type {Product} from './types'

export function CheckoutHub(){
 const {checkoutId}=useParams(),[products,setProducts]=useState<Product[]>([]),[selected,setSelected]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 useEffect(()=>{let active=true;setLoading(true);productServiceV2.list().then(rows=>{if(!active)return;setProducts(rows);setSelected(current=>rows.some(p=>p.id===current)?current:rows[0]?.id||'');setError('')}).catch(()=>{if(active)setError('Não foi possível carregar seus produtos. Confira sua conexão e tente novamente.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[retry])
 const product=products.find(p=>p.id===selected)
 return <div className="pv2 checkout-hub page-enter"><div className="co-hub-hero"><div><span className="co-hub-eyebrow"><LayoutTemplate/><T> CHECKOUT STUDIO</T></span><h1><T>Seu produto merece</T><br/><T>uma boa primeira impressão.</T></h1><p><T>Crie uma experiência de compra com a sua identidade. Imagens, vídeos e um link pronto para compartilhar.</T></p></div><div className="co-hub-feature"><Video/><b><T>Da apresentação à compra.</T></b><span><T>Banner em imagem ou vídeo</T><br/><T>Prévia desktop e celular</T><br/><T>Publicação com link público</T></span></div></div>{checkoutId&&<p className="pv2-notice"><T>Selecione o produto para gerenciar seus checkouts. Links de compra publicados usam o endereço /pay/ do checkout.</T></p>}{loading?<div className="co-hub-loading"><LoaderCircle className="spin"/><T>Carregando produtos…</T></div>:error?<div role="alert" className="pv2-notice">{error}<button className="btn" onClick={()=>setRetry(n=>n+1)}><T>Tentar novamente</T></button></div>:!products.length?<div className="co-hub-empty"><Package/><h2><T>Comece pelo seu produto</T></h2><p><T>Cadastre o produto e uma oferta para criar um checkout personalizado.</T></p><Link className="btn btn-primary" to="/app/produtos"><T>Cadastrar produto</T><ArrowRight/></Link></div>:<><label className="co-product-picker"><span><T>Produto que você quer vender</T></span><select className="input" value={selected} onChange={e=>setSelected(e.target.value)}>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{product&&<ProductCheckoutsPage key={product.id} product={product}/>}</>}</div>
}
