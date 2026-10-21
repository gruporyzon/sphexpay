import { render,screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach,describe,expect,it,vi } from 'vitest'
import type { FinancialTransaction } from '../lib/dashboardFinance'
import { buildLedger,ledgerCsv,revenueSeries,scheduleLabel,summarizeTransactions } from '../features/finance/financeSummary'
// @ts-expect-error Server-side JavaScript is tested outside the frontend bundle.
import { loadConnectedFinance } from '../../server/stripe/finance.js'

const authState=vi.hoisted(()=>({user:{id:'seller-1'}}))
vi.mock('../hooks/useAuth',()=>({useAuth:()=>authState}))
const services=vi.hoisted(()=>({loadTransactions:vi.fn(),finance:vi.fn()}))
vi.mock('../services/dashboardService',()=>({dashboardService:{loadTransactions:services.loadTransactions}}))
vi.mock('../services/stripeConnectService',()=>({stripeConnectService:{finance:services.finance,status:vi.fn(async()=>({mode:'live',connected:true,onboardingComplete:true,detailsSubmitted:true,chargesEnabled:true,payoutsEnabled:true,onboardingStatus:'enabled',requirements:{currentlyDue:[],eventuallyDue:[]}}))}}))
vi.mock('../components/finance/StripeConnectCard',()=>({StripeConnectCard:()=>null}))
vi.mock('../features/kyc/KycStatusNotice',()=>({KycStatusNotice:()=>null}))
import { FinancialOverview } from '../pages/FinancialHub'

const now=new Date()
const sale=(over:Partial<FinancialTransaction>):FinancialTransaction=>({transactionId:`t-${Math.random()}`,buyerName:'Ana',productName:'Curso',paymentMethod:'card',status:'approved',amountCents:10000,grossAmountCents:10000,feeCents:500,netAmountCents:9500,currency:'BRL',occurredAt:now.toISOString(),...over})
const bounds={start:new Date(now.getTime()-7*864e5),end:new Date(now.getTime()+60e3)}

afterEach(()=>{vi.clearAllMocks();vi.unstubAllEnvs()})

describe('cálculos do Financeiro',()=>{
 it('soma só vendas aprovadas e conta reembolsos e contestações na aprovação',()=>{
  const summary=summarizeTransactions([sale({}),sale({amountCents:20000,grossAmountCents:20000,feeCents:1000,netAmountCents:19000}),sale({status:'refunded'}),sale({status:'chargeback'}),sale({status:'declined'}),sale({status:'pending'}),sale({currency:'USD'})])
  expect(summary).toMatchObject({grossCents:30000,feesCents:1500,netCents:28500,approvedCount:2,averageTicketCents:15000,refundedCount:1,refundedCents:10000,chargebackCount:1,pendingCount:1,otherCurrencies:['USD']})
  expect(summary.approvalRate).toBeCloseTo(80)
 })
 it('monta o extrato só com vendas e repasses do período',()=>{
  const ledger=buildLedger([sale({productName:'=HYPERLINK("x")'}),sale({status:'declined'})],[
   {id:'po_in',amountCents:9000,currency:'BRL',status:'paid',automatic:true,createdAt:now.toISOString(),arrivalDate:now.toISOString(),failureMessage:null,destination:{bankName:null,last4:'1234'}},
   {id:'po_old',amountCents:1,currency:'BRL',status:'paid',automatic:true,createdAt:'2020-01-01T00:00:00Z',arrivalDate:'2020-01-02T00:00:00Z',failureMessage:null,destination:null}
  ],bounds)
  expect(ledger.map(row=>row.type).sort()).toEqual(['Entrada','Saída'])
  expect(ledger.find(row=>row.type==='Saída')).toMatchObject({amountCents:-9000,description:'Repasse para a conta final 1234',status:'Concluído'})
  expect(ledgerCsv(ledger).find(row=>row.tipo==='Entrada')?.descricao).toBe('Venda · =HYPERLINK("x")')
 })
 it('agrupa o faturamento por dia e descreve a agenda de repasses',()=>{
  const series=revenueSeries([sale({}),sale({status:'refunded'})],bounds)
  expect(series.length).toBeGreaterThanOrEqual(8)
  expect(series.reduce((total,point)=>total+point.revenueCents,0)).toBe(10000)
  expect(scheduleLabel({interval:'weekly',weeklyAnchor:'friday',delayDays:7,monthlyAnchor:null})).toBe('Semanal, toda sexta-feira')
  expect(scheduleLabel(null)).toBe('Agenda não informada')
 })
})

describe('saldo e repasses na Stripe (servidor)',()=>{
 const connection={stripe_mode:'live',user_id:'seller-1',stripe_account_id:'acct_seller'}
 const database=(row:unknown)=>({from:()=>{const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:row,error:null,status:200})};return query}})
 const stripe=()=>({
  accounts:{retrieve:vi.fn(async(id:string)=>({id,payouts_enabled:true,metadata:{sphex_user_id:'seller-1'},settings:{payouts:{schedule:{interval:'daily',delay_days:2}}}}))},
  balance:{retrieve:vi.fn(async()=>({available:[{amount:1500,currency:'brl'}],pending:[{amount:700,currency:'brl'}]}))},
  payouts:{list:vi.fn(async()=>({data:[{id:'po_1',amount:900,currency:'brl',status:'in_transit',automatic:true,created:1760000000,arrival_date:1760086400,destination:{bank_name:'Banco',last4:'4821',routing_number:'000',fingerprint:'secret'}}]}))}
 })
 it('lê saldo e repasses da conta conectada e devolve só dados seguros',async()=>{
  vi.stubEnv('STRIPE_SECRET_KEY','sk_live_fixture')
  const client=stripe(),result=await loadConnectedFinance(database(connection),{id:'seller-1'},client)
  expect(client.balance.retrieve).toHaveBeenCalledWith({},{stripeAccount:'acct_seller'})
  expect(client.payouts.list).toHaveBeenCalledWith(expect.objectContaining({limit:30}),{stripeAccount:'acct_seller'})
  expect(result).toMatchObject({connected:true,payoutsEnabled:true,balance:{available:[{amountCents:1500,currency:'BRL'}],pending:[{amountCents:700,currency:'BRL'}]},schedule:{interval:'daily',delayDays:2}})
  expect(result.payouts[0]).toEqual({id:'po_1',amountCents:900,currency:'BRL',status:'in_transit',automatic:true,createdAt:new Date(1760000000000).toISOString(),arrivalDate:new Date(1760086400000).toISOString(),failureMessage:null,destination:{bankName:'Banco',last4:'4821'}})
  expect(JSON.stringify(result)).not.toMatch(/routing|fingerprint|secret/)
 })
 it('responde sem conta conectada e recusa conta de outro vendedor',async()=>{
  vi.stubEnv('STRIPE_SECRET_KEY','sk_live_fixture')
  expect(await loadConnectedFinance(database(null),{id:'seller-1'},stripe())).toMatchObject({connected:false,payouts:[]})
  const client=stripe();client.accounts.retrieve.mockResolvedValue({id:'acct_seller',metadata:{sphex_user_id:'other'}} as never)
  await expect(loadConnectedFinance(database(connection),{id:'seller-1'},client)).rejects.toMatchObject({code:'CONNECT_OWNERSHIP_MISMATCH',status:403})
 })
})

describe('Visão geral do Financeiro',()=>{
 it('mostra saldo da Stripe e vendas reais, sem valores editáveis',async()=>{
  services.loadTransactions.mockResolvedValue([sale({productName:'Mentoria'})])
  services.finance.mockResolvedValue({mode:'live',connected:true,payoutsEnabled:true,balance:{available:[{amountCents:123400,currency:'BRL'}],pending:[{amountCents:5000,currency:'BRL'}]},schedule:null,payouts:[]})
  render(<MemoryRouter><FinancialOverview/></MemoryRouter>)
  expect(await screen.findByText('Venda · Mentoria')).toBeInTheDocument()
  expect(screen.getByText(/1\.234,00/)).toBeInTheDocument()
  expect(screen.getAllByText(/95,00/).length).toBeGreaterThan(0)
  expect(screen.queryByText('Valores bloqueados')).not.toBeInTheDocument()
  expect(screen.queryByRole('button',{name:/Editar/})).not.toBeInTheDocument()
 })
 it('mostra estado vazio e o erro da Stripe sem inventar saldo',async()=>{
  services.loadTransactions.mockResolvedValue([])
  services.finance.mockRejectedValue(new Error('Não foi possível consultar o saldo e os repasses agora.'))
  render(<MemoryRouter><FinancialOverview/></MemoryRouter>)
  expect(await screen.findByText('Nenhuma movimentação no período')).toBeInTheDocument()
  expect(await screen.findByText('Não foi possível consultar o saldo e os repasses agora.')).toBeInTheDocument()
  expect(screen.getAllByText('—').length).toBe(2)
 })
})
