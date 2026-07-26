import { convertCents,type Currency,type ExchangeRate } from '../../lib/dashboardFinance'
import { formatCents } from '../../lib/currencyFormat'

export function ConvertedMoney({amountCents,sourceCurrency,displayCurrency,rates,showOriginal=false}:{amountCents:number;sourceCurrency:Currency;displayCurrency:Currency;rates:ExchangeRate[];showOriginal?:boolean}){
 const converted=convertCents(amountCents,sourceCurrency,displayCurrency,rates)
 if(!converted)return <span title="Conversão indisponível">{formatCents(amountCents,sourceCurrency)} <small>conversão indisponível</small></span>
 return <span>{showOriginal&&converted.converted&&<small>{formatCents(amountCents,sourceCurrency)} · </small>}{formatCents(converted.amountCents,displayCurrency)}{converted.converted&&<small title={`Taxa ${converted.rate} · ${converted.source} · ${converted.observedAt}`}> convertido</small>}</span>
}
