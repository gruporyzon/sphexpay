import { render,screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach,describe,expect,it,vi } from 'vitest'
import { AwardAdminPanel } from '../features/awards/AwardAdminPanel'
import { awardService } from '../services/awardService'

const address={recipient:'Ana Lima',phone:'11999990000',postalCode:'01310-100',street:'Av. Paulista',number:'1000',complement:'',district:'Bela Vista',city:'São Paulo',state:'SP',country:'Brasil',reference:''}
afterEach(()=>vi.restoreAllMocks())

describe('pedidos de premiação (equipe)',()=>{
 it('mostra o endereço e salva status e rastreio',async()=>{
  const list=vi.spyOn(awardService,'adminList').mockResolvedValue([{id:'r1',awardId:'10k',status:'requested',address,trackingCode:null,requestedAt:'2026-10-21T10:00:00Z',updatedAt:'2026-10-21T10:00:00Z',sellerName:'Ana Lima',sellerEmail:'ana@exemplo.com'}])
  const update=vi.spyOn(awardService,'adminUpdate').mockResolvedValue(undefined)
  const user=userEvent.setup()
  render(<AwardAdminPanel/>)
  expect(await screen.findByText(/Av\. Paulista, 1000/)).toBeInTheDocument()
  expect(list).toHaveBeenCalledWith('requested')
  await user.selectOptions(screen.getByLabelText('Status do pedido de ana@exemplo.com'),'shipped')
  await user.type(screen.getByPlaceholderText('Opcional'),'BR123')
  await user.click(screen.getByRole('button',{name:/Salvar/}))
  expect(update).toHaveBeenCalledWith('r1','shipped','BR123')
  await user.click(screen.getByRole('button',{name:'Todos'}))
  expect(list).toHaveBeenLastCalledWith(undefined)
 })
})
