import type { CommerceNotificationType,Sale } from '../types'
import { notificationTitles } from './notificationCatalog'
import { sanitizeNotificationBody } from './notificationSanitizer'

export type GeneratorDestination='device'
export type GeneratorMode='single'|'batch'|'scheduled'|'recurring'
export type GeneratorStatus='completed'|'running'|'paused'|'cancelled'|'scheduled'|'failed'
export type ValueLabel='Sua comissão'|'Valor'|'Total'|'Recebido'|'Lucro'|'Faturamento'
export type PreviewDevice='iphone'|'android'|'desktop'
export interface GeneratorConfig{
 title:string;customBody:string;valueLabel:ValueLabel;value:number;currency:Sale['currency'];showTime:boolean;simulatedTime:string
 quantity:number;intervalValue:number;intervalUnit:'seconds'|'minutes'|'hours';mode:GeneratorMode;destination:GeneratorDestination
 startAt:string;endAt:string;continuous:boolean;variation:boolean;minValue:number;maxValue:number;rotateCurrencies:boolean
 avoidRepeatedValues:boolean;rotateTypes:boolean;types:CommerceNotificationType[]
}
export interface GeneratorHistory{
 id:string;createdAt:string;title:string;value:number;currency:Sale['currency'];type:CommerceNotificationType;destination:GeneratorDestination
 requested:number;sent:number;intervalMs:number;status:GeneratorStatus;config:GeneratorConfig
}
export interface GeneratorPreset{id:string;name:string;createdAt:string;config:GeneratorConfig}

export const generatorTypes:CommerceNotificationType[]=['sale_approved','sale_pending','pix_generated','pix_approved','pix_paid','credit_card_approved','credit_card_refused','boleto_generated','boleto_paid','subscription_approved','subscription_renewed','refund_done','chargeback_received','withdrawal_requested','withdrawal_completed']
export const defaultGeneratorConfig:GeneratorConfig={title:notificationTitles.sale_approved,customBody:'',valueLabel:'Sua comissão',value:3.83,currency:'BRL',showTime:true,simulatedTime:'agora',quantity:1,intervalValue:5,intervalUnit:'seconds',mode:'single',destination:'device',startAt:'',endAt:'',continuous:false,variation:false,minValue:3.5,maxValue:17.9,rotateCurrencies:false,avoidRepeatedValues:true,rotateTypes:false,types:['sale_approved']}
export const generatorTemplates:{id:string;name:string;description:string;config:Partial<GeneratorConfig>}[]=[
 {id:'sale',name:'Venda aprovada padrão',description:'Uma confirmação objetiva e discreta.',config:{types:['sale_approved'],title:notificationTitles.sale_approved,value:3.83,quantity:1,mode:'single'}},
 {id:'pix',name:'Pix gerado padrão',description:'Aviso imediato para uma cobrança Pix.',config:{types:['pix_generated'],title:notificationTitles.pix_generated,value:12.9,quantity:1}},
 {id:'card',name:'Cartão aprovado padrão',description:'Confirmação de pagamento no cartão.',config:{types:['credit_card_approved'],title:'Cartão aprovado!',value:8.4}},
 {id:'subscription',name:'Assinatura aprovada',description:'Modelo para receita recorrente.',config:{types:['subscription_approved'],title:notificationTitles.subscription_approved,value:19.9}},
 {id:'social',name:'Modo prova social',description:'Alterna eventos em ritmo moderado.',config:{types:['sale_approved','pix_paid','credit_card_approved'],rotateTypes:true,variation:true,quantity:10,intervalValue:10,mode:'batch'}},
 {id:'high',name:'Modo comissão alta',description:'Faixa variável para comissões maiores.',config:{variation:true,minValue:80,maxValue:450,value:180}},
 {id:'intense',name:'Modo volume intenso',description:'Sequência curta com limite seguro.',config:{quantity:20,intervalValue:3,mode:'batch',rotateTypes:true}},
 {id:'quiet',name:'Modo discreto',description:'Sequência espaçada no dispositivo.',config:{destination:'device',quantity:5,intervalValue:30,mode:'batch'}},
 {id:'recurring',name:'Modo recorrente',description:'Ciclo controlado a cada cinco minutos.',config:{mode:'recurring',quantity:20,intervalValue:5,intervalUnit:'minutes'}}
]
export const intervalMilliseconds=(config:GeneratorConfig)=>Math.max(1000,config.intervalValue*(config.intervalUnit==='hours'?3600000:config.intervalUnit==='minutes'?60000:1000))
export function formatGeneratorValue(value:number,currency:Sale['currency']){
 const locale=currency==='USD'?'en-US':'pt-BR',formatted=new Intl.NumberFormat(locale,{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(value)
 return currency==='USD'?formatted.replace('$','US$'):formatted
}
export const generatorBody=(config:GeneratorConfig,value=config.value,currency=config.currency)=>sanitizeNotificationBody(config.customBody)||`${config.valueLabel}: ${formatGeneratorValue(value,currency)}`
export function validateGenerator(config:GeneratorConfig){
 if(!config.title.trim())return'O título é obrigatório.'
 if(!Number.isFinite(config.value)||config.value<0)return'Informe um valor válido.'
 if(!Number.isInteger(config.quantity)||config.quantity<1||config.quantity>100)return'A quantidade deve estar entre 1 e 100.'
 if(!Number.isFinite(config.intervalValue)||config.intervalValue<=0)return'O intervalo precisa ser maior que zero.'
 if(!config.types.length)return'Selecione pelo menos um tipo de notificação.'
 if(config.variation&&config.minValue>config.maxValue)return'O valor mínimo não pode superar o máximo.'
 if(config.mode==='scheduled'&&(!config.startAt||new Date(config.startAt).getTime()<=Date.now()))return'Escolha uma data futura para o agendamento.'
 return''
}
export function variedValue(config:GeneratorConfig,previous?:number){
 if(!config.variation)return config.value
 const generate=()=>Math.round((config.minValue+Math.random()*(config.maxValue-config.minValue))*100)/100
 let value=generate()
 if(config.avoidRepeatedValues&&value===previous)value=generate()
 return value
}
const storageKey='sphexpay_notification_generator_v1'
export function loadGeneratorData():{config:GeneratorConfig;history:GeneratorHistory[];presets:GeneratorPreset[]}{
 try{const saved=JSON.parse(localStorage.getItem(storageKey)||'{}'),migrate=(config:GeneratorConfig)=>{const compatible={...config} as GeneratorConfig&{sound?:boolean;volume?:number;soundStyle?:string};delete compatible.sound;delete compatible.volume;delete compatible.soundStyle;compatible.customBody=sanitizeNotificationBody(compatible.customBody);return{...defaultGeneratorConfig,...compatible,destination:'device' as const}};return{config:migrate(saved.config||defaultGeneratorConfig),history:Array.isArray(saved.history)?saved.history.slice(0,100).map((item:GeneratorHistory)=>({...item,destination:'device',config:migrate(item.config)})):[],presets:Array.isArray(saved.presets)?saved.presets.map((preset:GeneratorPreset)=>({...preset,config:migrate(preset.config)})):[]}}catch{return{config:defaultGeneratorConfig,history:[],presets:[]}}
}
export function saveGeneratorData(config:GeneratorConfig,history:GeneratorHistory[],presets:GeneratorPreset[]){localStorage.setItem(storageKey,JSON.stringify({config,history:history.slice(0,100),presets}))}
