import {Monitor,Moon,Sun} from 'lucide-react'
import {useDemoStore} from '../../store/useDemoStore'
import {useTranslation} from '../../i18n'
import {appLanguages,useAppLocale} from '../../i18n/localeStore'

export function AppearancePreferences(){
 const preference=useDemoStore(state=>state.themePreference),setTheme=useDemoStore(state=>state.setTheme),{t}=useTranslation()
 return <fieldset className="workspace-preference-section"><legend>{t('Aparência')}</legend><p>{t('Escolha como a SphexPay aparece neste dispositivo.')}</p><div className="workspace-appearance-options">{([['light','Modo claro',Sun],['dark','Modo escuro',Moon],['system','Seguir preferência do sistema',Monitor]] as const).map(([value,label,Icon])=><label key={value}><input type="radio" name="workspace-appearance" value={value} checked={preference===value} onChange={()=>setTheme(value)}/><Icon aria-hidden="true"/><span>{t(label)}</span></label>)}</div></fieldset>
}
export function LanguagePreferences(){
 const locale=useAppLocale(state=>state.locale),setLocale=useAppLocale(state=>state.setLocale),{t}=useTranslation()
 return <fieldset className="workspace-preference-section"><legend>{t('Idioma do aplicativo')}</legend><p>{t('A escolha é salva neste navegador e também pode ser alterada no cabeçalho.')}</p><div className="workspace-appearance-options workspace-locale-options">{appLanguages.map(language=><label key={language.locale}><input type="radio" name="workspace-locale" value={language.locale} checked={locale===language.locale} onChange={()=>setLocale(language.locale)}/><img src={language.flag} alt="" width="24" height="18"/><span>{language.name}</span></label>)}</div></fieldset>
}
