import { MemoryRouter,Route,Routes } from 'react-router-dom'
import { render,screen,waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach,describe,expect,it,vi } from 'vitest'

const mocks=vi.hoisted(()=>({
 auth:{loading:false,user:{id:'u1'},aal:{current:'aal1',next:'aal1'},mfaRequired:false,refreshAssurance:vi.fn()},
 mfa:{
  listFactors:vi.fn(),
  verifiedTotpFactor:vi.fn(),
  enroll:vi.fn(),
  challengeAndVerify:vi.fn(),
  unenroll:vi.fn(),
  assuranceLevel:vi.fn()
 },
 supabaseConfigured:true
}))

vi.mock('../hooks/useAuth',()=>({useAuth:()=>mocks.auth}))
vi.mock('../services/authService',()=>({
 authMessage:(e:unknown)=>String((e as Error)?.message||'erro'),
 recordSecurityEvent:vi.fn(),
 mfaService:mocks.mfa
}))
vi.mock('../lib/supabase',()=>({isSupabaseConfigured:true}))

import { TwoFactorCard } from '../components/settings/TwoFactorCard'
import { RequireAAL2 } from '../routes/RequireAAL2'

beforeEach(()=>{
 vi.clearAllMocks()
 mocks.auth={loading:false,user:{id:'u1'},aal:{current:'aal1',next:'aal1'},mfaRequired:false,refreshAssurance:vi.fn()}
 mocks.mfa.listFactors.mockResolvedValue({all:[],totp:[]})
 mocks.mfa.verifiedTotpFactor.mockReturnValue(undefined)
})

describe('TwoFactorCard',()=>{
 it('mostra o estado inativo e inicia a ativação com QR Code',async()=>{
  mocks.mfa.enroll.mockResolvedValue({id:'f1',totp:{qr_code:'data:image/svg+xml;base64,PHN2Zy8+',secret:'ABCDEF'}})
  const user=userEvent.setup()
  render(<TwoFactorCard/>)
  const activate=await screen.findByRole('button',{name:/Ativar verificação em duas etapas/})
  await user.click(activate)
  expect(await screen.findByAltText(/QR Code/)).toBeInTheDocument()
  expect(screen.getByText('ABCDEF')).toBeInTheDocument()
 })

 it('mostra o estado ativo quando existe um fator TOTP verificado',async()=>{
  mocks.mfa.listFactors.mockResolvedValue({all:[{id:'f1',factor_type:'totp',status:'verified'}],totp:[{id:'f1',factor_type:'totp',status:'verified'}]})
  mocks.mfa.verifiedTotpFactor.mockReturnValue({id:'f1',factor_type:'totp',status:'verified'})
  render(<TwoFactorCard/>)
  expect(await screen.findByRole('button',{name:/Desativar verificação em duas etapas/})).toBeInTheDocument()
  expect(screen.getByText('Ativa')).toBeInTheDocument()
 })
})

describe('RequireAAL2',()=>{
 const renderGuard=()=>render(
  <MemoryRouter initialEntries={['/app/saques']}>
   <Routes>
    <Route element={<RequireAAL2/>}><Route path="/app/saques" element={<h1>Saques</h1>}/></Route>
    <Route path="/entrar" element={<h1>Entrar</h1>}/>
   </Routes>
  </MemoryRouter>
 )

 it('libera a rota quando a conta não exige AAL2',async()=>{
  renderGuard()
  expect(await screen.findByRole('heading',{name:'Saques'})).toBeInTheDocument()
 })

 it('redireciona ao login quando o segundo fator está pendente',async()=>{
  mocks.auth.mfaRequired=true
  mocks.auth.aal={current:'aal1',next:'aal2'}
  renderGuard()
  await waitFor(()=>expect(screen.getByRole('heading',{name:'Entrar'})).toBeInTheDocument())
 })
})
