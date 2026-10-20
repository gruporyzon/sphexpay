import {translate as uiText} from '../../i18n'
import {useAppLocale} from '../../i18n/localeStore'
import {T} from '../../i18n'
import { convertCents,type Currency,type ExchangeRate } from '../../lib/dashboardFinance'
import { formatCents } from '../../lib/currencyFormat'

export function ConvertedMoney({amountCents,sourceCurrency,displayCurrency,rates,showOriginal=false}:{amountCents:number;sourceCurrency:Currency;displayCurrency:Currency;rates:ExchangeRate[];showOriginal?:boolean}){useAppLocale(state=>state.locale);
 const converted=convertCents(amountCents,sourceCurrency,displayCurrency,rates)
 if(!converted)return <span title={uiText("Conversão indisponível")}>{formatCents(amountCents,sourceCurrency)} <small><T>conversão indisponível</T></small></span>
 const time=converted.observedAt?new Date(converted.observedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):''
 return <span>{showOriginal&&converted.converted&&<small>{formatCents(amountCents,sourceCurrency)} · </small>}{formatCents(converted.amountCents,displayCurrency)}{converted.converted&&<small title={`Taxa ${converted.rate} · ${converted.source} · ${converted.observedAt}`}><T> convertido · taxa </T>{time}</small>}</span>
}
