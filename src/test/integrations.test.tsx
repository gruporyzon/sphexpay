import { render,screen,within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach,describe,expect,it,vi } from 'vitest'
import Integrations from '../pages/Integrations'

const service=vi.hoisted(()=>({list:vi.fn(),deliveries:vi.fn(),create:vi.fn(),update:vi.fn(),remove:vi.fn(),secret:vi.fn(),test:vi.fn()}))
vi.mock('../services/sellerWebhookService',async original=>({...await original<object>(),sellerWebhookService:service}))

const hook={id:'wh-1',name:'Planilha',url:'https://hooks.exemplo.com/a',events:['sale.approved'],active:true,createdAt:'2026-10-20T10:00:00Z',updatedAt:'2026-10-20T10:00:00Z'}
afterEach(()=>vi.clearAllMocks())

describe('Integrações',()=>{
 it('não mostra apps conectados, chaves ou status inventados',async()=>{
  service.list.mockResolvedValue([]);service.deliveries.mockResolvedValue([])
  render(<Integrations/>)
  expect(await screen.findByText(/Nenhum webhook configurado/)).toBeInTheDocument()
  expect(screen.queryByText(/99,98%|API operacional|Hotmart|spx_pub/)).not.toBeInTheDocument()
  const user=userEvent.setup()
  await user.click(screen.getByRole('tab',{name:/Apps/}))
  expect(screen.getAllByText('Via webhook')).toHaveLength(4)
  expect(screen.queryByText('Conectado')).not.toBeInTheDocument()
 })
 it('cria webhook com eventos escolhidos e mostra o segredo uma vez',async()=>{
  service.list.mockResolvedValueOnce([]).mockResolvedValue([hook]);service.deliveries.mockResolvedValue([])
  service.create.mockResolvedValue({id:'wh-1',secret:'whsec_abc123'})
  const user=userEvent.setup()
  render(<Integrations/>)
  await screen.findByText(/Nenhum webhook configurado/)
  await user.click(screen.getAllByRole('button',{name:/Criar webhook/})[0])
  await user.type(screen.getByLabelText('Nome'),'Planilha')
  await user.type(screen.getByLabelText('URL do endpoint'),'http://inseguro.com')
  await user.click(screen.getByRole('checkbox',{name:/Venda reembolsada/}))
  const form=screen.getByLabelText('Nome').closest('.webhook-form') as HTMLElement
  await user.click(within(form).getByRole('button',{name:'Criar webhook'}))
  expect(screen.getByRole('alert')).toHaveTextContent('https://')
  expect(service.create).not.toHaveBeenCalled()
  await user.clear(screen.getByLabelText('URL do endpoint'))
  await user.type(screen.getByLabelText('URL do endpoint'),'https://hooks.exemplo.com/a')
  await user.click(within(form).getByRole('button',{name:'Criar webhook'}))
  expect(service.create).toHaveBeenCalledWith({name:'Planilha',url:'https://hooks.exemplo.com/a',events:['sale.approved','sale.refunded'],active:true})
  expect(await screen.findByDisplayValue('whsec_abc123')).toBeInTheDocument()
  expect(await screen.findByText('https://hooks.exemplo.com/a')).toBeInTheDocument()
 })
 it('envia teste, mostra o segredo sob demanda e lista as entregas reais',async()=>{
  service.list.mockResolvedValue([hook])
  service.deliveries.mockResolvedValue([{id:'d-1',webhookId:'wh-1',eventType:'webhook.test',status:'failed',attempts:7,responseStatus:500,lastError:'Resposta HTTP 500',nextAttemptAt:'2026-10-21T10:00:00Z',deliveredAt:null,createdAt:'2026-10-21T09:00:00Z'}])
  service.test.mockResolvedValue(undefined);service.secret.mockResolvedValue('whsec_visivel')
  const user=userEvent.setup()
  render(<Integrations/>)
  await user.click(await screen.findByRole('button',{name:'Enviar teste para Planilha'}))
  expect(service.test).toHaveBeenCalledWith('wh-1')
  expect(await screen.findByText(/Teste enviado/)).toBeInTheDocument()
  await user.click(screen.getByRole('button',{name:'Ver segredo de Planilha'}))
  expect(await screen.findByDisplayValue('whsec_visivel')).toBeInTheDocument()
  expect(service.secret).toHaveBeenCalledWith('wh-1',false)
  await user.click(screen.getByRole('tab',{name:/Entregas/}))
  const row=screen.getByText('Teste').closest('tr') as HTMLElement
  expect(within(row).getByText('Falhou')).toBeInTheDocument()
  expect(within(row).getByText('HTTP 500')).toBeInTheDocument()
 })
 it('pede confirmação antes de remover',async()=>{
  service.list.mockResolvedValue([hook]);service.deliveries.mockResolvedValue([]);service.remove.mockResolvedValue(undefined)
  const user=userEvent.setup()
  render(<Integrations/>)
  await user.click(await screen.findByRole('button',{name:'Remover Planilha'}))
  expect(service.remove).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button',{name:'Remover'}))
  expect(service.remove).toHaveBeenCalledWith('wh-1')
 })
})
