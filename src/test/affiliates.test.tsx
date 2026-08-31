import {act,render,screen,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {beforeEach,describe,expect,it,vi} from 'vitest'
import type {Affiliate,AffiliatePage} from '../features/affiliates/types'

const mocks=vi.hoisted(()=>({list:vi.fn(),products:vi.fn(),all:vi.fn()}))
vi.mock('../features/affiliates/affiliateService',()=>({affiliateService:mocks}))
import AffiliatesPage from '../features/affiliates/AffiliatesPage'

const affiliate:Affiliate={id:'affiliate-1',publicId:'AFF-8K29X1',name:'Ana Martins',email:'ana@example.com',status:'active',joinedAt:'2026-08-31T14:25:00Z',products:[{id:'link-1',productId:'product-1',productName:'Método Premium',commissionType:'percentage',commissionValue:20,currency:'BRL'},{id:'link-2',productId:'product-2',productName:'Mentoria',commissionType:'fixed',commissionValue:5000,currency:'BRL'}]}
const result=(items:Affiliate[]=[],count=items.length,page=1):AffiliatePage=>({items,count,page,pageSize:20})

describe('módulo de Afiliados',()=>{
 beforeEach(()=>{mocks.list.mockReset().mockResolvedValue(result([affiliate]));mocks.products.mockReset().mockResolvedValue([{id:'product-1',name:'Método Premium'}]);mocks.all.mockReset().mockResolvedValue([affiliate]);Object.defineProperty(window,'innerWidth',{configurable:true,value:1280})})

 it('está protegido pela rota atual e aparece em Crescimento na sidebar',()=>{
  const app=readFileSync(resolve(process.cwd(),'src/App.tsx'),'utf8'),layout=readFileSync(resolve(process.cwd(),'src/components/Layout.tsx'),'utf8')
  expect(app).toContain("['afiliados',<Deferred><AffiliatesPage/></Deferred>]")
  expect(app.indexOf('{modules.map',app.indexOf('<Route element={<ProtectedRoute/>}>'))).toBeGreaterThan(app.indexOf('<Route element={<ProtectedRoute/>}>'))
  expect(layout).toContain("['Afiliados','/app/afiliados',UserRoundCheck]")
 })

 it('mostra skeleton antes da query e depois dados reais, contador e comissões',async()=>{
  let finish:(value:AffiliatePage)=>void=()=>undefined;mocks.list.mockReturnValue(new Promise(resolve=>{finish=resolve}))
  render(<AffiliatesPage/>);expect(screen.getByRole('status',{name:'Carregando afiliados'})).toBeVisible();expect(screen.queryByText('Nenhum afiliado encontrado')).not.toBeInTheDocument()
  act(()=>finish(result([affiliate])));expect(await screen.findByText('1 afiliado')).toBeVisible();expect(screen.getAllByText('Ana Martins').length).toBeGreaterThan(0);expect(screen.getAllByText('20%').length).toBeGreaterThan(0);expect(screen.getAllByText('Método Premium').length).toBeGreaterThan(0)
 })

 it('distingue estado vazio de erro e permite tentar novamente',async()=>{
  mocks.list.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(result())
  render(<AffiliatesPage/>);expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os afiliados.');await userEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));expect(await screen.findByText('Nenhum afiliado encontrado')).toBeVisible();expect(screen.getByText('0 afiliados')).toBeVisible();expect(screen.getByRole('table')).toContainElement(screen.getByText('Nenhum afiliado encontrado'))
 })

 it('mantém a composição minimalista e deixa busca/filtros fora da superfície principal',async()=>{render(<AffiliatesPage/>);expect(await screen.findByText('1 afiliado')).toBeVisible();expect(screen.getByRole('table')).toBeInTheDocument();expect(screen.queryByPlaceholderText('Nome, email, ID ou produto')).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:/Filtros/})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Exportar'})).toBeInTheDocument()})

 it('pagina no servidor e abre detalhes sem métricas inventadas',async()=>{
  mocks.list.mockResolvedValue(result([affiliate],21));render(<AffiliatesPage/>);await screen.findByText('21 afiliados');const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'Próxima página'}));await waitFor(()=>expect(mocks.list).toHaveBeenLastCalledWith(expect.any(Object),2,20));await user.click(screen.getByRole('button',{name:'Detalhes'}));const dialog=screen.getByRole('dialog',{name:'Ana Martins'});expect(dialog).toHaveTextContent('Informações');expect(dialog).toHaveTextContent('Produtos e comissão');expect(dialog).toHaveTextContent(/R\$\s50,00/);expect(dialog).not.toHaveTextContent('Taxa de conversão');await user.keyboard('{Escape}');expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
 })

 it('exporta CSV somente com os registros autorizados devolvidos pelo serviço',async()=>{
  const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>undefined),create=vi.spyOn(URL,'createObjectURL');render(<AffiliatesPage/>);await screen.findByText('1 afiliado');await userEvent.click(screen.getByRole('button',{name:'Exportar'}));expect(mocks.all).toHaveBeenCalledWith(expect.objectContaining({query:'',status:'',productId:''}));expect(create).toHaveBeenCalledWith(expect.any(Blob));expect(click).toHaveBeenCalled();click.mockRestore();create.mockRestore()
 })

 it('usa tabela semântica no desktop, lista em cards no mobile e tokens de tema neutros',async()=>{
  const {container}=render(<AffiliatesPage/>);await screen.findByText('1 afiliado');expect(screen.getByRole('table')).toBeInTheDocument();expect(container.querySelector('.affiliate-mobile-list .affiliate-card')).toBeInTheDocument();const css=readFileSync(resolve(process.cwd(),'src/features/affiliates/affiliates.css'),'utf8');expect(css).toContain('@media(max-width:680px)');expect(css).toContain('.affiliate-table-wrap{display:none}');expect(css).toContain('background:var(--panel)');expect(css).not.toMatch(/orange|gradient/i)
 })

 it('mantém isolamento por merchant no serviço e RLS aditiva nas duas tabelas',()=>{
  const service=readFileSync(resolve(process.cwd(),'src/features/affiliates/affiliateService.ts'),'utf8'),migration=readFileSync(resolve(process.cwd(),'supabase/migrations/20260831223000_affiliates_v1.sql'),'utf8')
  expect(service.match(/\.eq\('merchant_id',merchantId\)/g)?.length).toBeGreaterThanOrEqual(3);expect(service).toContain(".eq('seller_id',merchantId)")
  expect(migration).toContain('alter table public.affiliates force row level security');expect(migration).toContain('alter table public.affiliate_products force row level security');expect(migration.match(/merchant_id=auth\.uid\(\)/g)?.length).toBeGreaterThanOrEqual(8);expect(migration).toContain('affiliate_products_product_owner_fk')
 })
})
