import { render,screen,waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { AuthContext,type AuthContextValue } from '../providers/authContext'
import { WorkspaceSidebar } from '../components/navigation/WorkspaceSidebar'
import { MemberRouteGuard } from '../features/team/WorkspaceSwitcher'
import { TeamSettings } from '../features/team/TeamSettings'
import { memberCanOpen } from '../lib/teamAccess'
import { customerService } from '../services/customerService'
import { shippingService } from '../services/shippingService'
import { couponCenterService } from '../services/couponCenterService'
import { listPaymentLinks } from '../features/products/paymentLinksService'
import { productServiceV2 } from '../features/products/productServiceV2'
import { useWorkspaceStore } from '../store/useWorkspaceStore'
// @ts-expect-error Backend JavaScript stays outside the frontend bundle.
import { resolveWorkspace } from '../../server/security/teamAccess.js'

const rpc=vi.fn()
// Consultas encadeadas (from().select().eq()...) ficam registradas em `queries` para conferir a conta usada.
const queries:{table:string;calls:unknown[][]}[]=[]
const builder=(table:string)=>{const entry={table,calls:[] as unknown[][]};queries.push(entry);const chain:Record<string,unknown>={then:(resolve:(value:unknown)=>unknown)=>resolve({data:[],error:null})};for(const method of ['select','eq','is','order','limit','insert','update','neq'])chain[method]=(...args:unknown[])=>{entry.calls.push([method,...args]);return chain};return chain}
vi.mock('../lib/supabase',()=>({supabase:{rpc:(...args:unknown[])=>rpc(...args),from:(table:string)=>builder(table),auth:{getSession:async()=>({data:{session:{user:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}}}})}}}))

const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',member='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const auth=(id:string)=>({user:{id} as User,session:null,loading:false,configured:true,aal:{current:null,next:null},mfaRequired:false,refreshAssurance:async()=>{},signOut:async()=>{}}) as AuthContextValue
const asMember=(role:'admin'|'finance'|'support')=>useWorkspaceStore.getState().setWorkspace({ownerId:owner,ownerName:'Loja da Ana',ownerEmail:'ana@x.com',role})
beforeEach(()=>{rpc.mockReset();queries.length=0;useWorkspaceStore.getState().setWorkspace(null)})
afterEach(()=>localStorage.clear())

describe('acesso por cargo nas telas',()=>{
 it('libera só as áreas de cada cargo e mantém o dono com acesso total',()=>{
  expect(memberCanOpen(null,'/app/produtos')).toBe(true)
  expect(memberCanOpen('support','/app/vendas')).toBe(true)
  expect(memberCanOpen('support','/app/vendas','?aba=encomendas')).toBe(true)
  expect(memberCanOpen('support','/app/vendas','?aba=contestacoes')).toBe(false)
  expect(memberCanOpen('support','/app/financeiro')).toBe(false)
  expect(memberCanOpen('support','/app/relatorios/clientes')).toBe(true)
  expect(memberCanOpen('support','/app/relatorios')).toBe(false)
  expect(memberCanOpen('finance','/app/financeiro/cobrancas')).toBe(true)
  expect(memberCanOpen('finance','/app/vendas','?aba=contestacoes')).toBe(true)
  for(const role of ['admin','finance','support'] as const)for(const path of ['/app/vitrine','/app/verificacao','/app/integracoes','/app/afiliados','/app/relatorios/indicacoes','/app/premiacoes'])expect(memberCanOpen(role,path)).toBe(false)
  // Catálogo: só o Administrador, e sem as seções que guardam dinheiro ou credenciais.
  expect(memberCanOpen('admin','/app/produtos')).toBe(true)
  expect(memberCanOpen('admin','/app/produtos/cupons')).toBe(true)
  expect(memberCanOpen('admin','/app/produtos/p1/offers')).toBe(true)
  expect(memberCanOpen('admin','/app/produtos/checkout/c1')).toBe(true)
  for(const section of ['payments','delivery','tracking','coproduction','affiliates'])expect(memberCanOpen('admin',`/app/produtos/p1/${section}`)).toBe(false)
  expect(memberCanOpen('finance','/app/produtos')).toBe(false)
  expect(memberCanOpen('support','/app/produtos/fretes')).toBe(false)
  expect(memberCanOpen('support','/app/configuracoes')).toBe(true)
 })
 it('o menu do colaborador de suporte esconde produtos e financeiro',()=>{
  asMember('support')
  render(<AuthContext.Provider value={auth(member)}><MemoryRouter initialEntries={['/app/vendas']}><WorkspaceSidebar/></MemoryRouter></AuthContext.Provider>)
  expect(screen.getByRole('link',{name:'Transações'})).toBeInTheDocument()
  expect(screen.getByRole('link',{name:'Encomendas'})).toBeInTheDocument()
  expect(screen.queryByRole('link',{name:'Contestações'})).not.toBeInTheDocument()
  expect(screen.queryByRole('button',{name:'Produtos'})).not.toBeInTheDocument()
  expect(screen.queryByRole('button',{name:'Financeiro'})).not.toBeInTheDocument()
 })
 it('mostra aviso no lugar de uma área fora do cargo',()=>{
  asMember('support')
  render(<AuthContext.Provider value={auth(member)}><MemoryRouter initialEntries={['/app/produtos']}><MemberRouteGuard><p>catálogo</p></MemberRouteGuard></MemoryRouter></AuthContext.Provider>)
  expect(screen.getByText('Área fora do seu cargo')).toBeInTheDocument()
  expect(screen.queryByText('catálogo')).not.toBeInTheDocument()
 })
 it('o dono continua vendo tudo mesmo com uma escolha antiga salva do mesmo id',()=>{
  useWorkspaceStore.getState().setWorkspace({ownerId:owner,ownerName:'',ownerEmail:'',role:'support'})
  render(<AuthContext.Provider value={auth(owner)}><MemoryRouter initialEntries={['/app/produtos']}><MemberRouteGuard><p>catálogo</p></MemberRouteGuard></MemoryRouter></AuthContext.Provider>)
  expect(screen.getByText('catálogo')).toBeInTheDocument()
 })
})

describe('serviços na conta ativa',()=>{
 it('envia a conta escolhida para as consultas e nulo na própria conta',async()=>{
  rpc.mockResolvedValue({data:[],error:null})
  await customerService.customers()
  expect(rpc).toHaveBeenLastCalledWith('seller_customers',{p_seller:null})
  asMember('support')
  await customerService.abandoned();await shippingService.shipments()
  expect(rpc).toHaveBeenCalledWith('seller_abandoned_checkouts',{p_seller:owner})
  expect(rpc).toHaveBeenLastCalledWith('seller_shipments',{p_seller:owner})
  await shippingService.updateShipment('order','shipped','BR123')
  expect(rpc).toHaveBeenLastCalledWith('seller_update_shipment',{p_seller:owner,p_order_id:'order',p_status:'shipped',p_tracking_code:'BR123'})
 })
})

describe('catálogo na conta ativa',()=>{
 const eqs=(table:string)=>queries.filter(entry=>entry.table===table).flatMap(entry=>entry.calls.filter(call=>call[0]==='eq'))
 it('o Administrador lista e cria produtos, cupons, fretes e links na conta de quem convidou',async()=>{
  rpc.mockResolvedValue({data:'novo',error:null})
  asMember('admin')
  await productServiceV2.list();await couponCenterService.list();await shippingService.rates()
  expect(eqs('products')).toContainEqual(['eq','seller_id',owner])
  expect(eqs('product_coupons')).toContainEqual(['eq','seller_id',owner])
  expect(eqs('shipping_rates')).toContainEqual(['eq','seller_id',owner])
  await productServiceV2.create(owner,{name:'X'} as never)
  expect(rpc).toHaveBeenLastCalledWith('create_product_v2',{p_input:{name:'X',sellerId:owner}})
  rpc.mockResolvedValue({data:[],error:null})
  await listPaymentLinks()
  expect(rpc).toHaveBeenLastCalledWith('seller_payment_links',{p_seller:owner})
 })
 it('na própria conta lista só os próprios itens e o histórico registra quem fez',async()=>{
  await couponCenterService.list();await productServiceV2.list()
  expect(eqs('product_coupons')).toContainEqual(['eq','seller_id',member])
  expect(eqs('products')).toContainEqual(['eq','seller_id',member])
  asMember('admin')
  await productServiceV2.setStatus(owner,'p1','paused')
  const log=queries.find(entry=>entry.table==='product_activity_log')!.calls.find(call=>call[0]==='insert')![1] as {seller_id:string;actor_id:string}
  expect(log).toMatchObject({seller_id:owner,actor_id:member})
 })
 it('o Administrador não vê exclusão nem as seções do dono no menu do catálogo',()=>{
  asMember('admin')
  render(<AuthContext.Provider value={auth(member)}><MemoryRouter initialEntries={['/app/produtos']}><WorkspaceSidebar/></MemoryRouter></AuthContext.Provider>)
  expect(screen.getByRole('link',{name:'Cupons'})).toBeInTheDocument()
  expect(screen.getByRole('link',{name:'Fretes'})).toBeInTheDocument()
  expect(screen.queryByRole('link',{name:'Vitrine'})).not.toBeInTheDocument()
 })
})

describe('acesso da equipe no servidor',()=>{
 const database=(row:{role:string}|null,error:unknown=null)=>{const calls:unknown[][]=[];const query={select:()=>query,eq:(...args:unknown[])=>{calls.push(args);return query},maybeSingle:async()=>({data:row,error})};return{calls,db:{from:()=>query}}}
 it('o próprio usuário passa sem consulta e o colaborador precisa do cargo certo',async()=>{
  const none=database(null)
  expect(await resolveWorkspace(none.db,{id:member},'','finance.read')).toEqual({id:member})
  expect(none.calls).toEqual([])
  const finance=database({role:'finance'})
  expect(await resolveWorkspace(finance.db,{id:member},owner,'finance.read')).toEqual({id:owner})
  expect(finance.calls).toEqual([['owner_id',owner],['member_id',member],['status','active']])
  await expect(resolveWorkspace(database({role:'support'}).db,{id:member},owner,'finance.read')).rejects.toMatchObject({code:'FORBIDDEN',status:403})
  await expect(resolveWorkspace(database(null).db,{id:member},owner,'disputes.read')).rejects.toMatchObject({code:'FORBIDDEN'})
  await expect(resolveWorkspace(database({role:'admin'}).db,{id:member},'not-a-uuid','finance.read')).rejects.toMatchObject({code:'FORBIDDEN'})
  await expect(resolveWorkspace(database(null,{message:'down'}).db,{id:member},owner,'finance.read')).rejects.toMatchObject({code:'TEAM_STORAGE_ERROR'})
 })
})

describe('gestão da equipe em Configurações',()=>{
 it('convida com cargo, mostra o link uma vez e lista a equipe',async()=>{
  const user=userEvent.setup()
  rpc.mockImplementation(async(name:string)=>name==='invite_team_member'?{data:'abc123',error:null}:{data:[{id:'m1',email:'bia@x.com',role:'finance',status:'active',invited_at:'2026-10-20T10:00:00Z',accepted_at:'2026-10-21T10:00:00Z',member_name:'Bia Souza'}],error:null})
  render(<TeamSettings/>)
  expect(await screen.findByText('Bia Souza')).toBeInTheDocument()
  await user.type(screen.getByLabelText('E-mail'),'caio@x.com')
  await user.selectOptions(screen.getByLabelText('Cargo'),'admin')
  await user.click(screen.getByRole('button',{name:/Criar convite/}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledWith('invite_team_member',{p_email:'caio@x.com',p_role:'admin'}))
  expect(await screen.findByText(/\/convite\/abc123$/)).toBeInTheDocument()
 })
 it('traduz o erro de e-mail já convidado',async()=>{
  const user=userEvent.setup()
  rpc.mockImplementation(async(name:string)=>name==='invite_team_member'?{data:null,error:{message:'ALREADY_INVITED'}}:{data:[],error:null})
  render(<TeamSettings/>)
  await screen.findByText('Ninguém na equipe ainda')
  await user.type(screen.getByLabelText('E-mail'),'bia@x.com')
  await user.click(screen.getByRole('button',{name:/Criar convite/}))
  expect(await screen.findByText('Este e-mail já está na sua equipe.')).toBeInTheDocument()
 })
})
