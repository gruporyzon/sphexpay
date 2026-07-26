import type { Currency } from './dashboardFinance'

export const currencyLocale:Record<Currency,string>={BRL:'pt-BR',USD:'en-US',EUR:'de-DE'}
export const formatCents=(amountCents:number,currency:Currency)=>new Intl.NumberFormat(currencyLocale[currency],{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(amountCents/100)
