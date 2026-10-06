import type {CSSProperties,ReactNode} from 'react'
import {Package,ArrowUpRight} from 'lucide-react'
import {CheckoutMedia} from './CheckoutMedia'
import {CheckoutCountdown} from './CheckoutCountdown'
import {checkoutElementOrder,checkoutElementSlot,providedCheckoutTemplate} from './checkoutTemplate'
import type {CheckoutElementKey,CheckoutSlot,CheckoutTemplate} from './checkoutTemplate'
import type {CheckoutBlock,PublishedCheckout} from './checkoutService'
import {safeCheckoutUrl} from './checkoutMedia'

export function CheckoutTemplateElement({element,template,fallback='sidebar',children}:{element?:CheckoutElementKey;template?:CheckoutTemplate;fallback?:CheckoutSlot;children:ReactNode}){
 const style=element&&template?.config.element_styles[element],animation=style&&style.animation,slot=checkoutElementSlot(template,element,fallback)
 const offsets={top:0,sidebar:150,pre_cta:300,form_bottom:500}
 return <section className={`co-template-element ${animation?`co-template-animation-${animation.preset}`:''}`} data-checkout-element={element} data-mobile-slot={slot} data-variant={element&&template?.config.element_variants[element]} style={{'--co-mobile-order':offsets[slot]+checkoutElementOrder(template,element),'--co-element-accent':style&&style.accent||'var(--co-primary)','--co-animation-duration':animation?.speed==='fast'?'1.6s':animation?.speed==='slow'?'5s':'3.2s',background:style&&style.background,color:style&&style.text} as CSSProperties}>{children}</section>
}
export function CheckoutTemplateBanner({block,product}:{block:CheckoutBlock;product:PublishedCheckout['product']}){
 if(safeCheckoutUrl(block.props.url))return <CheckoutMedia block={block}/>
 if(safeCheckoutUrl(product.imageUrl))return <CheckoutMedia block={{...block,props:{...block.props,url:product.imageUrl!,mediaKind:'image',alt:product.name}}}/>
 return <div className="co-template-banner"><div className="co-template-banner-copy"><span>{product.producerDisplayName||'SPHEXPAY'} · OFERTA SELECIONADA</span><h2>{product.name}</h2><p>{product.description||'Confira os detalhes da sua compra e continue com segurança.'}</p></div><div className="co-template-banner-art" aria-hidden="true"><i/><div><Package/><ArrowUpRight/></div><i/></div></div>
}
export function CheckoutTemplateTimer({block,template,preview}:{block:CheckoutBlock;template?:CheckoutTemplate;preview:boolean}){
 const key=block.props.elementKey==='countdown_deal'?'countdown_deal':'timer',options=template?.config.element_options[key],style=template?.config.timer.style||providedCheckoutTemplate.config.timer.style
 return <CheckoutCountdown endsAt={block.props.endsAt||options?.endsAt} startsAt={block.props.startsAt||options?.startsAt} title={String(block.props.title||'Prazo desta oferta')} style={style} preview={preview}/>
}
