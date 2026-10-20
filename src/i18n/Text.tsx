import {useEffect,type ReactNode} from 'react'
import {useAppLocale} from './localeStore'
import {useTranslation} from './useTranslation'

export function T({children}:{children:ReactNode}){const {t}=useTranslation();return typeof children==='string'?t(children):children}
export function LocaleDocument(){const locale=useAppLocale(state=>state.locale);useEffect(()=>{document.documentElement.lang=locale;return()=>{document.documentElement.lang='pt-BR'}},[locale]);return null}
