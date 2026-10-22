import { T,translate as uiText } from '../../i18n'
import { useAppLocale } from '../../i18n/localeStore'
import { Truck } from 'lucide-react'
import { formatCents } from '../../lib/currencyFormat'
import { maskCEP } from '../../lib/masks'

import { UF,deadline,type ShippingAddressInput,type ShippingRateOption } from './checkoutShipping'

export function CheckoutShippingFields({id,rates,rateId,address,currency,onRate,onAddress}:{id:string;rates:ShippingRateOption[];rateId:string;address:ShippingAddressInput;currency:'BRL'|'USD'|'EUR';onRate:(id:string)=>void;onAddress:(value:ShippingAddressInput)=>void}){useAppLocale(state=>state.locale)
 const field=(key:keyof ShippingAddressInput,label:string,props:Record<string,unknown>={})=><label htmlFor={`${id}-ship-${key}`}><T>{label}</T><input id={`${id}-ship-${key}`} value={address[key]} onChange={event=>onAddress({...address,[key]:key==='postalCode'?maskCEP(event.target.value):event.target.value})} {...props}/></label>
 return <fieldset className="co-shipping">
  <legend><Truck aria-hidden="true"/><T>Entrega</T></legend>
  <div className="co-shipping-grid">
   {field('postalCode','CEP',{required:true,inputMode:'numeric',autoComplete:'postal-code',placeholder:'00000-000',maxLength:9})}
   {field('street','Rua',{required:true,autoComplete:'address-line1',maxLength:120})}
   {field('number','Número',{required:true,maxLength:20})}
   {field('complement','Complemento',{autoComplete:'address-line2',maxLength:80,placeholder:uiText('Opcional')})}
   {field('district','Bairro',{required:true,maxLength:80})}
   {field('city','Cidade',{required:true,autoComplete:'address-level2',maxLength:80})}
   <label htmlFor={`${id}-ship-state`}><T>Estado</T><select id={`${id}-ship-state`} required value={address.state} onChange={event=>onAddress({...address,state:event.target.value})}><option value="">UF</option>{UF.map(uf=><option key={uf} value={uf}>{uf}</option>)}</select></label>
  </div>
  <div className="co-shipping-rates" role="radiogroup" aria-label={uiText('Opções de entrega')}>{rates.map(rate=><label key={rate.id} className={`co-method ${rateId===rate.id?'selected':''}`}><input type="radio" name={`${id}-shipping-rate`} value={rate.id} checked={rateId===rate.id} onChange={()=>onRate(rate.id)}/><div><b>{rate.name}{rate.carrier?` · ${rate.carrier}`:''}</b><span>{deadline(rate)?uiText(deadline(rate)):uiText('Prazo informado pelo vendedor')}</span></div><strong>{rate.priceCents?formatCents(rate.priceCents,currency):uiText('Grátis')}</strong></label>)}</div>
 </fieldset>
}
