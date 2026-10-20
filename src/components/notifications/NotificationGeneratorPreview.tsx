import {translate as uiText} from '../../i18n'
import {useAppLocale} from '../../i18n/localeStore'
import {T} from '../../i18n'
import { Monitor,Smartphone } from 'lucide-react'
import { useState } from 'react'
import { SphexPayLogo } from '../branding/SphexPayLogo'
import { generatorBody,type GeneratorConfig,type PreviewDevice } from '../../lib/notificationGenerator'

const devices:[PreviewDevice,string,typeof Smartphone][]=[['iphone','iPhone',Smartphone],['android','Android',Smartphone],['desktop','Desktop / Mac',Monitor]]
export function NotificationGeneratorPreview({config}:{config:GeneratorConfig}){useAppLocale(state=>state.locale);
 const [device,setDevice]=useState<PreviewDevice>('iphone')
 const time=config.showTime?(config.simulatedTime.trim()||'agora'):''
 return <section className="generator-preview-block"><div className="generator-section-head"><div><span><T>PRÉ-VISUALIZAÇÃO</T></span><h3><T>Representação estática da notificação</T></h3></div><nav aria-label={uiText("Dispositivo do preview")}>{devices.map(([value,label,Icon])=><button aria-pressed={device===value} className={device===value?'active':''} key={value} onClick={()=>setDevice(value)}><Icon/><T>{label}</T></button>)}</nav></div><div className={`generator-device-preview ${device}`}><div className="generator-device-bar"><i/><span><T>{device==='iphone'?'SphexPay':device==='android'?'Notificação do sistema':'SphexPay para desktop'}</T></span><b>{time}</b></div><article><div className="generator-preview-logo"><SphexPayLogo/></div><div><strong>{config.title||'Título da notificação'}</strong><p>{generatorBody(config)}</p></div>{time&&<time>{time}</time>}</article></div></section>
}
