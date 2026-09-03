import { MemoryRouter,Route,Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { render,screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach,describe,expect,it,vi } from 'vitest'
import LoginPage from '../pages/auth/LoginPage'
import SignupPage from '../pages/auth/SignupPage'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage'
import VerifyEmailPage from '../pages/auth/VerifyEmailPage'
import { consumeAuthEntrance,resetAuthEntranceForTests,shouldPlayAuthEntrance } from '../lib/authEntranceState'

const mocks=vi.hoisted(()=>({
 signIn:vi.fn(),signUp:vi.fn(),resetPassword:vi.fn(),resendConfirmation:vi.fn(),
 auth:{user:null as null|{email_confirmed_at?:string;user_metadata?:{onboarding_complete?:boolean}},configured:true,loading:false}
}))
vi.mock('../hooks/useAuth',()=>({useAuth:()=>mocks.auth}))
vi.mock('../services/authService',()=>({
 setSessionPersistence:vi.fn(),
 authMessage:()=> 'Não foi possível concluir a autenticação. Tente novamente.',
 authService:{signIn:mocks.signIn,signUp:mocks.signUp,resetPassword:mocks.resetPassword,resendConfirmation:mocks.resendConfirmation,signInWithOAuth:vi.fn()}
}))
vi.mock('../lib/supabase',()=>({supabaseUnavailableMessage:'A autenticação ainda não foi configurada para este ambiente.',oauthAvailability:{google:false,apple:false},authConfiguration:{configured:true,google:false,apple:false,isDevelopment:false}}))

const renderRoute=(element:ReactNode,path='/')=>render(<MemoryRouter initialEntries={[path]}><Routes><Route path="*" element={element}/><Route path="/app" element={<h1>Painel</h1>}/><Route path="/onboarding" element={<h1>Onboarding</h1>}/><Route path="/verificar-email" element={<h1>Confirmação enviada</h1>}/></Routes></MemoryRouter>)

describe('fluxos públicos de autenticação',()=>{
 beforeEach(()=>{vi.clearAllMocks();sessionStorage.clear();resetAuthEntranceForTests();mocks.auth={user:null,configured:true,loading:false};mocks.signIn.mockResolvedValue({data:{user:{email_confirmed_at:'2026-01-01',user_metadata:{onboarding_complete:true}}},error:null});mocks.signUp.mockResolvedValue({data:{user:{id:'new-user'}},error:null});mocks.resetPassword.mockResolvedValue({error:null});mocks.resendConfirmation.mockResolvedValue({error:null})})
 it('faz login real uma única vez e redireciona ao Dashboard',async()=>{
  consumeAuthEntrance();const user=userEvent.setup();renderRoute(<LoginPage/>,'/entrar')
  await user.type(screen.getByLabelText('E-mail'),'pessoa@example.com');await user.type(screen.getByLabelText('Senha'),'Senha@123')
  await user.click(screen.getByRole('button',{name:'Entrar'}))
  expect(mocks.signIn).toHaveBeenCalledOnce();expect(mocks.signIn).toHaveBeenCalledWith('pessoa@example.com','Senha@123')
  expect(await screen.findByRole('heading',{name:'Painel'})).toBeInTheDocument()
  expect(shouldPlayAuthEntrance()).toBe(true)
 })
 it('traduz falha de login sem mostrar erro cru',async()=>{
  consumeAuthEntrance();mocks.signIn.mockResolvedValue({data:{user:null},error:new Error('internal payload')});const user=userEvent.setup();renderRoute(<LoginPage/>,'/entrar')
  await user.type(screen.getByLabelText('E-mail'),'pessoa@example.com');await user.type(screen.getByLabelText('Senha'),'incorreta');await user.click(screen.getByRole('button',{name:'Entrar'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir a autenticação')
  expect(document.body).not.toHaveTextContent('internal payload')
  expect(shouldPlayAuthEntrance()).toBe(false)
 })
 it('valida e envia cadastro somente pelos campos suportados',async()=>{
  const user=userEvent.setup();renderRoute(<SignupPage/>,'/criar-conta')
  const inputs=screen.getAllByRole('textbox');await user.type(inputs[0],'Pessoa Teste');await user.type(inputs[1],'11999990000');await user.type(inputs[2],'pessoa@example.com')
  const passwords=screen.getAllByLabelText(/Senha|Confirmar senha/);await user.type(passwords[0],'Senha@123');await user.type(passwords[1],'Senha@123')
  for(const checkbox of screen.getAllByRole('checkbox'))await user.click(checkbox)
  await user.click(screen.getByRole('button',{name:'Criar conta'}))
  expect(mocks.signUp).toHaveBeenCalledOnce();expect(await screen.findByRole('heading',{name:'Confirmação enviada'})).toBeInTheDocument()
 })
 it('envia recuperação com resposta neutra',async()=>{
  const user=userEvent.setup();renderRoute(<ForgotPasswordPage/>,'/recuperar-senha');await user.type(screen.getByLabelText('E-mail'),'pessoa@example.com');await user.click(screen.getByRole('button',{name:'Enviar link de recuperação'}))
  expect(mocks.resetPassword).toHaveBeenCalledWith('pessoa@example.com')
  expect(await screen.findByText(/Se o e-mail estiver cadastrado/)).toBeInTheDocument()
 })
 it('mostra confirmação, troca de e-mail e reenvio com rate limit visual',async()=>{
  const user=userEvent.setup();render(<MemoryRouter initialEntries={[{pathname:'/verificar-email',state:{email:'pessoa@example.com'}}]}><VerifyEmailPage/></MemoryRouter>)
  expect(screen.getByRole('heading',{name:'Confirme seu e-mail'})).toBeInTheDocument()
  expect(screen.getByRole('link',{name:'Trocar e-mail'})).toHaveAttribute('href','/criar-conta')
  await user.click(screen.getByRole('button',{name:'Reenviar confirmação'}));expect(mocks.resendConfirmation).toHaveBeenCalledOnce()
  expect(screen.getByRole('button',{name:'Aguarde para reenviar'})).toBeDisabled()
 })
})
