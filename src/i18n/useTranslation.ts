import {useAppLocale} from './localeStore'
import {translate} from './translation'

export function useTranslation(){const locale=useAppLocale(state=>state.locale);return{locale,t:(text:string,values?:Record<string,string|number>)=>translate(text,locale,values)}}
