import {useId,useState} from 'react'
import {ArrowLeft,ArrowRight,Check,ChevronDown,CreditCard,LockKeyhole,Package,ShieldCheck,LoaderCircle,Mail} from 'lucide-react'
import type {CSSProperties,FormEvent} from 'react'
import {formatCents} from '../../lib/currencyFormat'
import {SphexPayLogo} from '../../components/branding/SphexPayLogo'
import {CheckoutTemplateElement,CheckoutTemplateBanner,CheckoutTemplateTimer} from './CheckoutTemplateElement'
import {checkoutElementKey,checkoutElementOrder,checkoutElementSlot,readCheckoutTemplate} from './checkoutTemplate'
import {CheckoutMedia} from './CheckoutMedia'
import {safeCheckoutUrl} from './checkoutMedia'
import {defaultCheckoutDesign,defaultSettings} from './checkoutService'
import type {CheckoutBlock,CheckoutDesign,CheckoutSettings,PublishedCheckout} from './checkoutService'
import './checkout-experience.css'
import './checkout-template.css'

export type CheckoutBuyer={name:string;email:string}
export type CheckoutProduct=PublishedCheckout['product']
const color=(value:string,fallback:string)=>/^#[a-f\d]{3}(?:[a-f\d]{3})?$/i.test(value)?value:fallback
function checkoutStyle(design:CheckoutDesign):CSSProperties {
 return {'--co-primary':color(design.primary,'#f15a24'),'--co-accent':color(design.accent,'#f15a24'),'--co-bg':color(design.background,'#fff'),'--co-card':color(design.card,'#fff'),'--co-text':color(design.text,'#171717'),'--co-radius':`${Math.max(0,Math.min(32,design.radius))}px`,'--co-width':`${Math.max(560,Math.min(1200,design.width))}px`,'--co-font':['Inter','system-ui','Arial'].includes(design.font)?design.font:'Inter'} as CSSProperties
}
export function CheckoutContentBlock({block}:{block:CheckoutBlock}) {
 const p=block.props
 if(['image','video','banner'].includes(block.type))return safeCheckoutUrl(p.url)?<CheckoutMedia block={block}/>:null
 if(block.type==='logo')return safeCheckoutUrl(p.url)?<img className="co-custom-logo" src={safeCheckoutUrl(p.url)} alt={String(p.alt||'Marca do vendedor')}/>:null
 if(['benefits','list'].includes(block.type))return <div className="co-benefits"><h3>{String(p.title||'Você recebe')}</h3><ul>{(Array.isArray(p.items)?p.items:[]).map((item,i)=><li key={i}><Check aria-hidden="true"/>{item}</li>)}</ul></div>
 if(block.type==='faq')return <details className="co-faq"><summary>{String(p.question||'Dúvida sobre a oferta')}<ChevronDown/></summary><p>{String(p.answer||'')}</p></details>
 if(block.type==='warranty')return <div className="co-guarantee"><ShieldCheck/><div><b>{String(p.title||'Condições da oferta')}</b><p>{String(p.text||'Confira as condições da oferta.')}</p></div></div>
 if(block.type==='testimonial')return <blockquote className="co-testimonial"><p>{String(p.text||'')}</p><cite>{String(p.name||'')}</cite></blockquote>
 if(block.type==='divider')return <hr/>
 if(block.type==='spacer')return <div style={{height:Math.max(0,Math.min(100,Number(p.height||24)))}}/>
 if(block.type==='timer')return <p className="co-caption">{String(p.text||'')} {String(p.duration||'')}</p>
 if(block.type==='order_bump')return null // Purchasable additions must be priced by the payment provider, never the browser.
 return <p className={block.type==='footer'?'co-caption':'co-copy'}>{String(p.text||'')}</p>
}

type Props={product:CheckoutProduct;price:number;currency:'BRL'|'USD'|'EUR';layout:CheckoutBlock[];design?:CheckoutDesign;settings?:CheckoutSettings;preview?:boolean;paymentAvailable?:boolean;paymentMessage?:string;onPay?:(buyer:CheckoutBuyer)=>Promise<void>;returned?:boolean;cancelled?:boolean;onRestart?:()=>void}
export function CheckoutExperience({product,price,currency,layout,design=defaultCheckoutDesign,settings=defaultSettings,preview=false,paymentAvailable=false,paymentMessage='',onPay,returned=false,cancelled=false,onRestart}:Props){
 const id=useId(),[step,setStep]=useState(1),[name,setName]=useState(''),[email,setEmail]=useState(''),[repeatEmail,setRepeatEmail]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const template=readCheckoutTemplate(settings)
 const visible=layout.filter(b=>!b.hidden&&(b.type!=='warranty'||settings.warranty)&&(b.type!=='timer'||settings.timer)),get=(type:string)=>visible.find(b=>b.type===type),title=String(get('title')?.props.text||'Finalize sua compra')
 const special=['title','buyer_form','payment_methods','order_summary','button','logo','footer']
 const extras=visible.filter(b=>!special.includes(b.type)),isTop=(b:CheckoutBlock)=>template?checkoutElementSlot(template,checkoutElementKey(b),b.props.position==='summary'?'sidebar':['banner','image','video','timer'].includes(b.type)?'top':'form_bottom')==='top':['banner','image','video'].includes(b.type),top=extras.filter(isTop).sort((a,b)=>checkoutElementOrder(template,checkoutElementKey(a))-checkoutElementOrder(template,checkoutElementKey(b))),content=extras.filter(b=>!isTop(b)&&b.props.position!=='summary'),summary=extras.filter(b=>!isTop(b)&&b.props.position==='summary'),footer=visible.filter(b=>b.type==='footer')
 const heading=get('title')?.props||{},headingStyle:CSSProperties={textAlign:['left','center','right'].includes(String(heading.align))?heading.align as 'left':undefined,fontSize:heading.size?`clamp(24px,5cqw,${Math.max(16,Math.min(64,Number(heading.size)))}px)`:undefined,fontWeight:heading.weight?Math.max(300,Math.min(900,Number(heading.weight))):undefined},logo=get('logo'),image=safeCheckoutUrl(product.imageUrl),total=formatCents(price,currency)
 const renderBlock=(b:CheckoutBlock)=>{const key=checkoutElementKey(b);if(b.type==='timer'&&!preview&&!Number.isFinite(Date.parse(String(b.props.endsAt||(key&&template?.config.element_options[key]?.endsAt)||''))))return null;if(b.type==='notice'&&key!=='progress_bar'&&!String(b.props.text||'').trim()&&!(key==='related_products'&&safeCheckoutUrl(b.props.url)))return null;return <CheckoutTemplateElement key={b.id} element={checkoutElementKey(b)} template={template} fallback={b.props.position==='summary'?'sidebar':'form_bottom'}>{b.type==='timer'?<CheckoutTemplateTimer block={b} template={template} preview={preview}/>:b.type==='banner'&&template?<CheckoutTemplateBanner block={b} product={product}/>:key==='progress_bar'?<div className="co-purchase-progress"><span>Etapa {returned?3:step} de 3</span><div role="progressbar" aria-label="Etapas do checkout" aria-valuemin={0} aria-valuemax={3} aria-valuenow={returned?3:step}><i style={{width:`${(returned?3:step)/3*100}%`}}/></div></div>:key==='related_products'&&safeCheckoutUrl(b.props.url)?<a className="co-related-offer" href={safeCheckoutUrl(b.props.url)} target="_blank" rel="noopener noreferrer"><Package/><span><b>{String(b.props.title||'Outra oferta do vendedor')}</b><small>{String(b.props.text||'Conheça esta oferta')}</small></span><ArrowRight/></a>:<CheckoutContentBlock block={b}/>}</CheckoutTemplateElement>}
 const submit=async(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault();if(busy)return;setError('')
  if(name.trim().length<2){setError('Informe seu nome completo.');return}
  if(settings.repeatEmail&&email.trim().toLowerCase()!==repeatEmail.trim().toLowerCase()){setError('Os e-mails precisam ser iguais.');return}
  if(step===1){setStep(2);return}
  if(preview){setError('Esta é uma prévia. Publique o checkout para gerar o link do comprador.');return}
  if(!paymentAvailable||!onPay)return
  setBusy(true)
  try{await onPay({name:name.trim(),email:email.trim().toLowerCase()})}catch(e){setError(e instanceof Error?e.message:'Não foi possível continuar. Tente novamente.');setBusy(false)}
 }
 return <div className={`co-experience ${preview?'co-preview':''} ${template?'co-template-active':''}`} style={checkoutStyle(design)}>
  <header className="co-header"><div className="co-container"><div className="co-brand">{logo&&safeCheckoutUrl(logo.props.url)?<CheckoutContentBlock block={logo}/>:<SphexPayLogo showName adaptiveTheme/>}</div><span><LockKeyhole/> Checkout protegido</span></div></header>
  {preview&&<div className="co-preview-notice">PRÉVIA INTERATIVA · NENHUMA COBRANÇA SERÁ REALIZADA</div>}
  <main className="co-container co-main">
   <div className="co-topline"><span>{product.producerDisplayName||'SPHEXPAY'} <i/> {product.name}</span><span><ShieldCheck/> Seus dados protegidos</span></div>
   <div className="co-top-elements">{top.map(renderBlock)}</div>
   <div className="co-grid">
    <div className="co-form-column">
     <div className="co-intro-group"><span className="co-eyebrow">FALTA POUCO PARA SER SEU</span><h1 style={headingStyle}>{title}</h1><p className="co-intro">Preencha seus dados e continue com segurança.</p></div>
     <ol className="co-steps" aria-label="Etapas da compra">{['Identificação','Pagamento','Confirmação'].map((label,i)=><li key={label} className={step>=i+1?'active':''} aria-current={step===i+1?'step':undefined}><span>{step>i+1?<Check/>:i+1}</span>{label}</li>)}</ol>
     {returned?<section className="co-return" role="status"><ShieldCheck/><h2>Pagamento em verificação</h2><p>Você retornou do ambiente de pagamento. A confirmação será enviada para o e-mail informado após o processamento.</p><button className="co-action" type="button" onClick={onRestart}>Iniciar outra compra<ArrowRight/></button></section>:<form className="co-buyer-form" onSubmit={e=>void submit(e)}>
      {cancelled&&<p className="co-alert" role="status">O pagamento foi interrompido. Você pode continuar sua compra.</p>}
      <section className={step===1?'co-form-section':'co-form-section co-hidden'} aria-hidden={step!==1}>
       <h2>{String(get('buyer_form')?.props.title||'Informações de contato')}</h2>
       <label htmlFor={`${id}-name`}>Nome completo<input id={`${id}-name`} name="name" required minLength={2} maxLength={120} autoComplete={settings.optimizedFill?"name":"off"} placeholder="Como podemos chamar você?" value={name} onChange={e=>setName(e.target.value)}/></label>
       <label htmlFor={`${id}-email`}>E-mail<input id={`${id}-email`} name="email" required type="email" maxLength={254} autoComplete={settings.optimizedFill?"email":"off"} inputMode="email" aria-describedby={`${id}-email-help`} placeholder="voce@exemplo.com" value={email} onChange={e=>setEmail(e.target.value)}/></label><small id={`${id}-email-help`}><Mail/> Receba a confirmação da sua compra neste endereço.</small>
       {settings.repeatEmail&&<label htmlFor={`${id}-repeat`}>Confirme seu e-mail<input id={`${id}-repeat`} required type="email" maxLength={254} inputMode="email" autoComplete="off" value={repeatEmail} onChange={e=>setRepeatEmail(e.target.value)} placeholder="Repita seu e-mail"/></label>}
      </section>
      {step===2&&<section className="co-payment-section"><div className="co-contact"><div><b>{name}</b><span>{email}</span></div><button type="button" onClick={()=>{setStep(1);setError('')}} disabled={busy}>Editar</button></div><h2>{String(get('payment_methods')?.props.title||'Pagamento')}</h2><div className={`co-method ${paymentAvailable||preview?'selected':''}`}><CreditCard/><div><b>Cartão de crédito</b><span>Dados de pagamento no ambiente seguro da Stripe.</span></div>{(paymentAvailable||preview)&&<Check/>}</div>{(settings.buyerAddress||settings.buyerTaxId||settings.buyerPhone)&&<p className="co-caption">Se forem necessários, os dados adicionais serão solicitados pelo processador no próximo passo.</p>}{!preview&&!paymentAvailable&&<p className="co-alert" role="status">{paymentMessage||'O vendedor ainda não habilitou o pagamento desta oferta.'}</p>}</section>}
      <div className="co-action-group"><div className="co-action-total"><span>Total desta compra</span><strong>{total}</strong></div>{error&&<p className="co-alert co-alert-error" role="alert">{error}</p>}
      <button className={`co-action co-action-${design.buttonStyle} co-action-shape-${design.buttonShape||'rounded'}`} disabled={busy||step===2&&!preview&&!paymentAvailable} type="submit">{busy?<><LoaderCircle className="spin"/>Abrindo pagamento…</>:<>{step===1?String(get('button')?.props.text||'Continuar para o pagamento'):'Ir para o pagamento seguro'}<ArrowRight/></>}</button>
      <p className="co-action-note"><LockKeyhole/> Nenhum dado de cartão é armazenado pela SphexPay.</p>
      {step===2&&<button className="co-back" type="button" onClick={()=>{setStep(1);setError('')}}><ArrowLeft/> Voltar para os dados</button>}</div>
     </form>}
     <div className="co-content">{content.map(renderBlock)}</div>
    </div>
    <aside className="co-summary-column"><div className="co-summary"><CheckoutTemplateElement element="product_info" template={template}><div className="co-product">{image?<img src={image} alt={product.name} onError={e=>{e.currentTarget.style.display='none'}}/>:<div className="co-product-icon"><Package/></div>}<div><b>{product.name}</b><span>{product.description?.slice(0,150)||'Oferta selecionada'}</span><small>Quantidade: 1</small></div></div></CheckoutTemplateElement><CheckoutTemplateElement element="order_summary" template={template} fallback="form_bottom"><div className="co-summary-heading"><h2>{String(get('order_summary')?.props.title||'Resumo do pedido')}</h2><span>01 item</span></div><dl className="co-totals"><div><dt>Valor da oferta</dt><dd>{total}</dd></div><div><dt>Quantidade</dt><dd>1</dd></div></dl><div className="co-total"><span>Total</span><strong>{total}</strong></div><p className="co-summary-foot">Revise os dados da oferta antes de continuar.</p></CheckoutTemplateElement><CheckoutTemplateElement element="payment_icons" template={template} fallback="form_bottom"><div className="co-trust"><span><ShieldCheck/>Compra protegida</span><span><LockKeyhole/>Conexão segura</span>{(paymentAvailable||preview)&&<span><CreditCard/>Cartão</span>}</div></CheckoutTemplateElement><div className="co-summary-extras">{summary.map(renderBlock)}</div></div></aside>
   </div>
   <footer className="co-footer">{footer.map(b=><CheckoutContentBlock key={b.id} block={b}/>)}<div><span>Powered by <b>SphexPay</b></span><nav aria-label="Informações legais do checkout"><a href="/termos" target="_blank" rel="noopener noreferrer">Termos</a><a href="/privacidade" target="_blank" rel="noopener noreferrer">Privacidade</a></nav></div></footer>
  </main>
 </div>
}
