import {create} from 'zustand'
import {persist} from 'zustand/middleware'

export type AppLocale='pt-BR'|'en-US'|'es-ES'
export const appLanguages=[
 {locale:'pt-BR',code:'PT',name:'Português (Brasil)',flag:'/flags/br.svg'},
 {locale:'en-US',code:'EN',name:'English (US)',flag:'/flags/us.svg'},
 {locale:'es-ES',code:'ES',name:'Español (España)',flag:'/flags/es.svg'},
] as const
export const normalizeAppLocale=(value:unknown):AppLocale=>value==='en-US'||value==='es-ES'?value:'pt-BR'
export const useAppLocale=create<{locale:AppLocale;setLocale:(locale:AppLocale)=>void}>()(persist(set=>({
 locale:'pt-BR',setLocale:locale=>set({locale:normalizeAppLocale(locale)}),
}),{name:'sphexpay-language-v1',version:1,partialize:state=>({locale:state.locale}),merge:(persisted,current)=>({...current,locale:normalizeAppLocale((persisted as {locale?:unknown}|undefined)?.locale)})}))
