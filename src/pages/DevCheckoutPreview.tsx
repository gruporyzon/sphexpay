import {useState} from 'react'
import {CheckoutExperience} from '../features/products/CheckoutExperience'
import {defaultCheckoutDesign,defaultSettings,templateLayout} from '../features/products/checkoutService'
import type {CheckoutDesign} from '../features/products/checkoutService'

export default function DevCheckoutPreview(){
 const [dark,setDark]=useState(false),[mobile,setMobile]=useState(false),[media,setMedia]=useState(false)
 const layout=templateLayout('minimal');if(media)layout[0].props.url=`${window.location.origin}/landing-reference/gallery-experience.webp`
 const design:CheckoutDesign={...defaultCheckoutDesign,...(dark?{background:'#0e0e0e',card:'#171717',text:'#f5f5f5'}:{})}
 return <div style={{background:'#e9e9e7',minHeight:'100vh'}}><div style={{display:'flex',gap:12,padding:16,justifyContent:'center'}}><button className="btn" onClick={()=>setDark(x=>!x)}>{dark?'Modo claro':'Modo escuro'}</button><button className="btn" onClick={()=>setMedia(x=>!x)}>{media?'Sem banner':'Com banner'}</button><button className="btn" onClick={()=>setMobile(x=>!x)}>{mobile?'Desktop':'Celular'}</button></div><div style={{maxWidth:mobile?390:1440,margin:'0 auto'}}><CheckoutExperience preview design={design} settings={{...defaultSettings,repeatEmail:true}} layout={layout} price={19700} currency="BRL" product={{id:'preview',name:'Experiência SphexPay',description:'Produto demonstrativo para conferir o visual e as etapas do checkout.',imageUrl:null,producerDisplayName:'GRUPO RYZON',warrantyDays:null}}/></div></div>
}
