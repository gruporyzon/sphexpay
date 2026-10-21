import { useCallback,useEffect,useState } from 'react'
import { Link,useNavigate } from 'react-router-dom'
import { Check,Copy,ExternalLink,Link2,PencilLine,Plus,RotateCcw } from 'lucide-react'
import { T,translate as uiText } from '../../i18n'
import { useAppLocale } from '../../i18n/localeStore'
import { Card,Empty,Loading,PageTitle,StateMessage,StatusBadge } from '../../components/ui'
import { listPaymentLinks,paymentLinkUrl,type PaymentLink } from './paymentLinksService'

const STATUS_LABEL:Record<string,string>={published:'Publicado',draft:'Rascunho',paused:'Pausado'}
const money=(cents:number,currency='BRL')=>new Intl.NumberFormat('pt-BR',{style:'currency',currency}).format(cents/100)

export function PaymentLinksPage(){
 useAppLocale(state=>state.locale)
 const navigate=useNavigate()
 const [links,setLinks]=useState<PaymentLink[]|null>(null),[error,setError]=useState(''),[copied,setCopied]=useState('')
 const load=useCallback(()=>{setError('');setLinks(null);listPaymentLinks().then(setLinks).catch(()=>{setLinks([]);setError('Não foi possível carregar seus links de pagamento.')})},[])
 useEffect(()=>{load()},[load])
 const copy=async(link:PaymentLink)=>{
  try{await navigator.clipboard.writeText(paymentLinkUrl(link.checkoutId));setCopied(link.checkoutId);window.setTimeout(()=>setCopied(current=>current===link.checkoutId?'':current),2200)}
  catch{setError('Não foi possível copiar. Selecione e copie o endereço manualmente.')}
 }
 const create=()=>navigate('/app/produtos/checkout')
 return <div className="page-enter payment-links-page">
  <PageTitle title={uiText('Links de pagamento')} subtitle={uiText('Compartilhe o endereço de pagamento dos seus checkouts publicados.')} action={<button className="btn btn-primary" onClick={create}><Plus size={16}/><T> Criar link</T></button>}/>
  {error&&<StateMessage title={uiText('Links indisponíveis')}><span>{error}</span> <button className="btn" onClick={load}><RotateCcw size={14}/><T> Tentar novamente</T></button></StateMessage>}
  {links===null?<Loading label="Carregando links"/>:links.length===0&&!error?<Card className="payment-links-empty"><Empty title={uiText('Nenhum link ainda')} text={uiText('Crie e publique um checkout para gerar o link de pagamento do seu produto.')}/><button className="btn btn-primary" onClick={create}><Plus size={15}/><T> Criar checkout</T></button></Card>:
  <div className="grid gap-4">{links.map(link=><Card className="p-5 flex flex-col md:flex-row md:items-center gap-4 payment-link-card" key={link.checkoutId}>
   <div className="w-11 h-11 rounded-xl bg-[var(--orange-soft)] orange grid place-items-center" aria-hidden="true"><Link2/></div>
   <div className="flex-1 min-w-0">
    <div className="flex gap-2 items-center flex-wrap"><b>{link.productName}</b><StatusBadge status={STATUS_LABEL[link.status]||link.status}/></div>
    <p className="muted text-xs mt-1">{link.checkoutName}{link.offerName?<> · {link.offerName}</>:null}</p>
    {link.isPublished?<p className="text-xs mt-1 break-all"><a href={paymentLinkUrl(link.checkoutId)} target="_blank" rel="noreferrer">{paymentLinkUrl(link.checkoutId)}</a></p>:<p className="muted text-xs mt-1"><T>Publique este checkout para ativar o link.</T></p>}
   </div>
   <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm">
    <div><span className="label"><T>Valor</T></span><b>{link.priceCents==null?'—':money(link.priceCents,link.currency)}</b></div>
    <div><span className="label"><T>Visitas</T></span><b>{link.views}</b></div>
    <div><span className="label"><T>Vendas</T></span><b>{link.paidCount}</b></div>
    <div><span className="label"><T>Faturado</T></span><b>{money(link.paidCents,link.currency)}</b></div>
   </div>
   <div className="flex gap-2 flex-wrap">
    {link.isPublished&&<button className="btn" onClick={()=>copy(link)} aria-label={`${uiText('Copiar link de')} ${link.productName}`}>{copied===link.checkoutId?<Check size={15}/>:<Copy size={15}/>}{copied===link.checkoutId?<T> Copiado</T>:<T> Copiar</T>}</button>}
    {link.isPublished&&<a className="btn" href={paymentLinkUrl(link.checkoutId)} target="_blank" rel="noreferrer"><ExternalLink size={15}/><T> Abrir</T></a>}
    <Link className="btn" to={`/app/produtos/checkout/${link.checkoutId}`}><PencilLine size={15}/><T> Editar</T></Link>
   </div>
  </Card>)}</div>}
  <p className="muted text-xs mt-4"><T>Visitas e vendas consideram apenas pagamentos reais aprovados. Vendas de teste não entram nesses números.</T></p>
 </div>
}
