import type {CheckoutBlock,CheckoutDesign,CheckoutSettings} from './checkoutService'

export const checkoutElementKeys=['timer','banner','product_info','advantages','testimonials','countdown_deal','progress_bar','urgency','scarcity','satisfaction','guarantee','payment_icons','order_summary','free_shipping','related_products'] as const
export type CheckoutElementKey=typeof checkoutElementKeys[number]
export type CheckoutSlot='top'|'sidebar'|'pre_cta'|'form_bottom'
export type JsonValue=string|number|boolean|null|JsonValue[]|{[key:string]:JsonValue}
export type ElementStyle={accent?:string;background?:string;text?:string;animation?:{preset:'none'|'shimmer'|'fade'|'pulse';speed:'slow'|'normal'|'fast'}}
export type TimerStyle={variant:'glass'|'solid'|'minimal';layout:'inline'|'stacked';size:'sm'|'md'|'lg';accent:string;background:string;text:string;showIcon:boolean;showProgress:boolean;showUnits:boolean}
export type CheckoutTemplate={version:1;kind:'checkout-template';config:{checkout_theme:'light'|'dark';checkout_accent_color:string;checkout_bg_color:string;checkout_button_style:'rounded'|'square'|'pill';element_variants:Partial<Record<CheckoutElementKey,string>>;element_styles:Partial<Record<CheckoutElementKey,ElementStyle>>;element_options:Partial<Record<CheckoutElementKey,Record<string,JsonValue>>>;mobile_elements_order:CheckoutElementKey[];mobile_elements_slots:Partial<Record<CheckoutElementKey,CheckoutSlot>>;custom_elements:CheckoutBlock[];timer:{style:TimerStyle}}}

// The exact configuration supplied by the project owner. Offer content stays separate.
export const providedCheckoutTemplate:CheckoutTemplate={version:1,kind:'checkout-template',config:{
 checkout_theme:'light',checkout_accent_color:'#6366f1',checkout_bg_color:'#ffffff',checkout_button_style:'rounded',
 element_variants:{banner:'Padrão'},element_styles:{banner:{accent:'#aa8666',animation:{preset:'shimmer',speed:'fast'}}},element_options:{banner:{}},
 mobile_elements_order:['timer','banner','product_info','advantages','testimonials','countdown_deal','progress_bar','urgency','scarcity','satisfaction','guarantee','payment_icons','order_summary','free_shipping','related_products'],
 mobile_elements_slots:{product_info:'sidebar',urgency:'pre_cta',scarcity:'pre_cta',satisfaction:'pre_cta',advantages:'sidebar',testimonials:'sidebar',order_summary:'form_bottom',payment_icons:'form_bottom',timer:'top',banner:'top',countdown_deal:'pre_cta',progress_bar:'pre_cta',guarantee:'form_bottom',related_products:'form_bottom',free_shipping:'sidebar'},
 custom_elements:[],timer:{style:{variant:'glass',layout:'inline',size:'md',accent:'#FACC15',background:'#0A0F1A',text:'#F8FAFC',showIcon:true,showProgress:true,showUnits:true}}
}}
const error=()=>new Error('Modelo inválido. Use a configuração checkout-template na versão 1.')
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value)
const hex=(value:unknown):value is string=>typeof value==='string'&&/^#[a-f\d]{3}(?:[a-f\d]{3})?$/i.test(value)
const member=(value:unknown,allowed:readonly string[])=>typeof value==='string'&&allowed.includes(value)
function safeTree(value:unknown,depth=0):boolean{
 if(depth>12)return false
 if(value===null||['string','boolean'].includes(typeof value))return typeof value!=='string'||value.length<=10000
 if(typeof value==='number')return Number.isFinite(value)
 if(Array.isArray(value))return value.length<=100&&value.every(x=>safeTree(x,depth+1))
 return object(value)&&Object.entries(value).every(([key,x])=>!['__proto__','prototype','constructor'].includes(key)&&safeTree(x,depth+1))
}
export function parseCheckoutTemplate(input:unknown):CheckoutTemplate{
 let value:unknown=input
 if(typeof input==='string'){if(input.length>65536)throw new Error('O modelo deve ter até 64 KB.');try{value=JSON.parse(input)}catch{throw new Error('JSON inválido. Confira as chaves, aspas e vírgulas.')}}
 if(!object(value)||value.version!==1||value.kind!=='checkout-template'||!object(value.config)||!safeTree(value))throw error()
 if(JSON.stringify(value).length>65536)throw new Error('O modelo deve ter até 64 KB.');
 const c=value.config
 if(!member(c.checkout_theme,['light','dark'])||!hex(c.checkout_accent_color)||!hex(c.checkout_bg_color)||!member(c.checkout_button_style,['rounded','square','pill']))throw error()
 for(const key of ['element_variants','element_styles','element_options','mobile_elements_slots'])if(!object(c[key]))throw error()
 if(!Array.isArray(c.mobile_elements_order)||c.mobile_elements_order.some(x=>!member(x,checkoutElementKeys))||new Set(c.mobile_elements_order).size!==c.mobile_elements_order.length)throw error()
 const slots=c.mobile_elements_slots as Record<string,unknown>,styles=c.element_styles as Record<string,unknown>
 if(Object.entries(slots).some(([key,slot])=>!member(key,checkoutElementKeys)||!member(slot,['top','sidebar','pre_cta','form_bottom'])))throw error()
 for(const [key,style] of Object.entries(styles)){
  if(!member(key,checkoutElementKeys)||!object(style))throw error()
  for(const prop of ['accent','background','text'])if(style[prop]!==undefined&&!hex(style[prop]))throw error()
  if(style.animation!==undefined&&(!object(style.animation)||!member(style.animation.preset,['none','shimmer','fade','pulse'])||!member(style.animation.speed,['slow','normal','fast'])))throw error()
 }
 if(Object.entries(c.element_variants as Record<string,unknown>).some(([key,v])=>!member(key,checkoutElementKeys)||typeof v!=='string'||v.length>50))throw error()
 if(Object.entries(c.element_options as Record<string,unknown>).some(([key,v])=>!member(key,checkoutElementKeys)||!object(v)))throw error()
 if(!Array.isArray(c.custom_elements))throw error()
 const safeTypes=['text','notice','banner','image','video','benefits','list','testimonial','warranty','faq','timer','divider','spacer','badge']
 if(c.custom_elements.some(b=>!object(b)||typeof b.id!=='string'||!member(b.type,safeTypes)||!object(b.props)||Object.values(b.props).some(p=>!(typeof p==='string'||typeof p==='number'||typeof p==='boolean'||Array.isArray(p)&&p.every(x=>typeof x==='string')))))throw error()
 if(!object(c.timer)||!object(c.timer.style))throw error()
 const t=c.timer.style
 if(!member(t.variant,['glass','solid','minimal'])||!member(t.layout,['inline','stacked'])||!member(t.size,['sm','md','lg'])||!['accent','background','text'].every(k=>hex(t[k]))||!['showIcon','showProgress','showUnits'].every(k=>typeof t[k]==='boolean'))throw error()
 return structuredClone(value) as CheckoutTemplate
}
export function readCheckoutTemplate(settings:CheckoutSettings):CheckoutTemplate|undefined{
 if(!settings.templateConfig)return undefined
 try{return parseCheckoutTemplate(settings.templateConfig)}catch{return undefined}
}
export function applyCheckoutTemplate(template:CheckoutTemplate,snapshot:{layout:CheckoutBlock[];design:CheckoutDesign;settings:CheckoutSettings}){
 const parsed=parseCheckoutTemplate(template),c=parsed.config,layout=[...snapshot.layout]
 if(!layout.some(b=>b.type==='banner'))layout.unshift({id:crypto.randomUUID(),type:'banner',props:{mediaKind:'image',url:'',ratio:'21/9',fit:'cover',alt:'Apresentação do produto'}})
 if(!layout.some(b=>b.type==='timer'))layout.unshift({id:crypto.randomUUID(),type:'timer',props:{title:'Prazo desta oferta',endsAt:'',startsAt:''}})
 if(layout.length+c.custom_elements.length>100)throw new Error('O checkout pode ter até 100 elementos.');
 const known=new Set(layout.map(b=>b.id));for(const block of c.custom_elements)if(!known.has(block.id)){layout.push(block);known.add(block.id)}
 return {layout,design:{...snapshot.design,primary:c.checkout_accent_color,accent:c.checkout_accent_color,background:c.checkout_bg_color,card:c.checkout_theme==='dark'?'#171717':'#ffffff',text:c.checkout_theme==='dark'?'#f8fafc':'#171717',buttonShape:c.checkout_button_style},settings:{...snapshot.settings,timer:true,templateConfig:parsed}}
}
export function checkoutElementKey(block:CheckoutBlock):CheckoutElementKey|undefined{
 if(member(block.props.elementKey,checkoutElementKeys))return block.props.elementKey as CheckoutElementKey
 const aliases:Partial<Record<CheckoutBlock['type'],CheckoutElementKey>>={banner:'banner',image:'banner',video:'banner',benefits:'advantages',list:'advantages',testimonial:'testimonials',warranty:'guarantee',timer:'timer',order_summary:'order_summary',badge:'satisfaction'}
 return aliases[block.type]
}
export function checkoutElementSlot(template:CheckoutTemplate|undefined,key:CheckoutElementKey|undefined,fallback:CheckoutSlot='sidebar'):CheckoutSlot{return key&&template?.config.mobile_elements_slots[key]||fallback}
export function checkoutElementOrder(template:CheckoutTemplate|undefined,key:CheckoutElementKey|undefined){const rank=key&&template?.config.mobile_elements_order.indexOf(key);return typeof rank==='number'&&rank>=0?rank:99}
export function exportCheckoutTemplate(template:CheckoutTemplate,design:CheckoutDesign):CheckoutTemplate{return {...structuredClone(template),config:{...structuredClone(template.config),checkout_accent_color:design.primary,checkout_bg_color:design.background,checkout_button_style:design.buttonShape||'rounded',checkout_theme:/^#(?:0|1|2)/i.test(design.background)?'dark':'light'}}}
