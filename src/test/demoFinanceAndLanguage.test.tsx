import {fireEvent,render,screen} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import {afterEach,describe,expect,it} from 'vitest'
import {demoFinance} from '../demo/demoFinance'
import type {FinancialTransaction} from '../lib/dashboardFinance'
import {LanguagePicker} from '../components/navigation/LanguagePicker'
import {useAppLocale} from '../i18n/localeStore'

const now=new Date('2026-10-23T12:00:00Z')
const sale=(daysAgo:number,amountCents:number,status:FinancialTransaction['status']='approved'):FinancialTransaction=>({transactionId:`t${daysAgo}${amountCents}`,buyerName:'A',productName:'P',paymentMethod:'Pix',status,amountCents,feeCents:Math.round(amountCents*.05),currency:'BRL',occurredAt:new Date(now.getTime()-daysAgo*86_400_000).toISOString()})

describe('financeiro da operação Demo',()=>{
 it('separa a receber dos últimos 2 dias e repasses diários das vendas anteriores',()=>{
  const finance=demoFinance([sale(0,10000),sale(1,20000),sale(3,30000),sale(3,10000),sale(5,50000),sale(4,9999,'declined')],now)
  expect(finance.connected).toBe(true)
  expect(finance.balance.pending[0].amountCents).toBe(9500+19000)
  expect(finance.payouts.map(item=>item.amountCents)).toEqual([38000,47500])
  expect(finance.payouts[0].status).toBe('in_transit')
  expect(finance.payouts[1].status).toBe('paid')
  expect(finance.platformFeeBps).toBe(500)
 })
 it('sem vendas aprovadas não inventa saldo nem taxa',()=>{
  const finance=demoFinance([sale(3,1000,'declined')],now)
  expect(finance.balance.available[0].amountCents).toBe(0)
  expect(finance.payouts).toEqual([])
  expect(finance.platformFeeBps).toBeNull()
 })
})

describe('seletor de idioma',()=>{
 afterEach(()=>useAppLocale.getState().setLocale('pt-BR'))
 it('troca o idioma mesmo quando o navegador tira o foco sem destino (Safari)',()=>{
  render(<MemoryRouter><LanguagePicker/></MemoryRouter>)
  fireEvent.click(screen.getByRole('button',{name:/Idioma do aplicativo/}))
  const english=screen.getByRole('menuitemradio',{name:'English (US)'})
  // Safari: tocar no item não o foca, e o foco sai do menu com relatedTarget nulo.
  fireEvent.blur(screen.getByRole('menuitemradio',{name:'Português (Brasil)'}),{relatedTarget:null})
  fireEvent.click(english)
  expect(useAppLocale.getState().locale).toBe('en-US')
 })
 it('fecha ao sair pelo teclado para fora do menu',()=>{
  render(<MemoryRouter><LanguagePicker/><button>fora</button></MemoryRouter>)
  fireEvent.click(screen.getByRole('button',{name:/Idioma do aplicativo/}))
  fireEvent.blur(screen.getByRole('menuitemradio',{name:'Português (Brasil)'}),{relatedTarget:screen.getByRole('button',{name:'fora'})})
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
 })
})
