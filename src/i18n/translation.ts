import {useAppLocale,type AppLocale} from './localeStore'
import {messages} from './messages'

export function translate(text:string,locale:AppLocale=useAppLocale.getState().locale,values:Record<string,string|number>={}){
 const key=text.replace(/\s+/g,' ').trim()
 const translated=locale==='pt-BR'?key:messages[key]?.[locale]??key
 const leading=text.match(/^\s*/)?.[0]??'',trailing=text.match(/\s*$/)?.[0]??''
 const result=leading+translated+trailing
 return result.replace(/\{(\w+)\}/g,(match,key)=>values[key]===undefined?match:String(values[key]))
}
