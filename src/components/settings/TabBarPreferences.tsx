import { T,useTranslation } from '../../i18n'
import { useTabBarPreferences } from '../../store/useTabBarPreferences'
import { tapFeedback } from '../../lib/tapFeedback'
import './tabBarPreferences.css'

// Ajustes da barra de navegação do celular: transparência (com prévia sobre um fundo colorido),
// esconder ao rolar e vibração ao tocar. Ficam salvos neste aparelho.
export function TabBarPreferences(){
 const {t}=useTranslation(),{transparency,hideOnScroll,haptics,setTransparency,setHideOnScroll,setHaptics}=useTabBarPreferences()
 const alpha=(.94-transparency/100*.66).toFixed(3)
 return <section className="tab-bar-preferences" aria-label={t('Barra de menu do celular')}>
  <div className="tbp-row tbp-head">
   <div><h3><T>Transparência da barra de menu</T></h3><p><T>Quanto do fundo aparece por trás da barra de baixo.</T></p></div>
   <b className="tbp-value">{transparency}%</b>
  </div>
  <div className="tbp-preview" aria-hidden="true">
   <i className="tbp-blob one"/><i className="tbp-blob two"/>
   <div className="tbp-bar" style={{'--tbp-alpha':alpha} as React.CSSProperties}><span/><span className="on"/><span/><span/><span className="round"/></div>
  </div>
  <input className="tbp-slider" type="range" min="0" max="100" step="1" value={transparency} aria-label={t('Transparência da barra de menu')} style={{'--tbp-fill':`${transparency}%`} as React.CSSProperties} onChange={event=>setTransparency(Number(event.target.value))}/>
  <label className="tbp-row tbp-toggle">
   <div><h3><T>Esconder a barra ao rolar</T></h3><p><T>A barra some quando você desce a tela e volta quando sobe.</T></p></div>
   <input type="checkbox" role="switch" checked={hideOnScroll} onChange={event=>{setHideOnScroll(event.target.checked);tapFeedback()}}/><i aria-hidden="true"/>
  </label>
  <label className="tbp-row tbp-toggle">
   <div><h3><T>Vibração ao tocar</T></h3><p><T>Pequena vibração nos botões da barra e do menu.</T></p></div>
   <input type="checkbox" role="switch" checked={haptics} onChange={event=>{setHaptics(event.target.checked);if(event.target.checked)tapFeedback()}}/><i aria-hidden="true"/>
  </label>
 </section>
}
