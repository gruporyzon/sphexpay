// Entrega no checkout de produto físico: tipos e validação compartilhados com a tela.
export type ShippingRateOption={id:string;name:string;carrier:string|null;priceCents:number;deliveryDaysMin:number|null;deliveryDaysMax:number|null}
export type ShippingAddressInput={postalCode:string;street:string;number:string;complement:string;district:string;city:string;state:string}
export const emptyShippingAddress:ShippingAddressInput={postalCode:'',street:'',number:'',complement:'',district:'',city:'',state:''}
export const UF=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

// Mesmas regras que o servidor confere: CEP, rua, número, bairro, cidade, UF e frete escolhido.
export function shippingProblem(address:ShippingAddressInput,rateId:string,rates:ShippingRateOption[]){
 if(!rates.some(rate=>rate.id===rateId))return'Escolha uma opção de entrega.'
 if(!/^\d{5}-?\d{3}$/.test(address.postalCode.trim()))return'Informe um CEP válido.'
 if(address.street.trim().length<2||!address.number.trim()||address.district.trim().length<2||address.city.trim().length<2)return'Preencha o endereço completo de entrega.'
 if(!UF.includes(address.state))return'Escolha o estado (UF).'
 return''
}
export const deadline=(rate:ShippingRateOption)=>rate.deliveryDaysMin!=null&&rate.deliveryDaysMax!=null?(rate.deliveryDaysMin===rate.deliveryDaysMax?`${rate.deliveryDaysMax} dias úteis`:`${rate.deliveryDaysMin} a ${rate.deliveryDaysMax} dias úteis`):rate.deliveryDaysMax!=null?`até ${rate.deliveryDaysMax} dias úteis`:''

