import { render,screen } from '@testing-library/react'
import { MemoryRouter,Route,Routes,useLocation } from 'react-router-dom'
import { beforeEach,describe,expect,it,vi } from 'vitest'
import { ProtectedRoute } from '../routes/ProtectedRoute'

const mocks=vi.hoisted(()=>({auth:{user:null as null|{id:string},loading:false}}))
vi.mock('../hooks/useAuth',()=>({useAuth:()=>mocks.auth}))

function LoginDestination(){const location=useLocation();return <div>Login: {location.state?.from}</div>}
function ProtectedDashboard(){return <MemoryRouter initialEntries={['/app?period=month']}><Routes><Route element={<ProtectedRoute/>}><Route path="/app" element={<button>Dashboard disponível</button>}/></Route><Route path="/entrar" element={<LoginDestination/>}/></Routes></MemoryRouter>}

describe('entrada direta na rota protegida',()=>{
 beforeEach(()=>{mocks.auth={user:null,loading:false}})
 it('disponibiliza o Dashboard imediatamente após validar a sessão',()=>{
  mocks.auth={user:{id:'user'},loading:true}
  const view=render(<ProtectedDashboard/>)
  expect(screen.getByText('Validando acesso seguro')).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  mocks.auth={user:{id:'user'},loading:false}
  view.rerender(<ProtectedDashboard/>)
  const dashboard=screen.getByRole('button',{name:'Dashboard disponível'})
  expect(dashboard).toBeVisible()
  expect(dashboard.closest('[inert]')).toBeNull()
  expect(screen.queryByText('Validando acesso seguro')).not.toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
 })
 it('preserva o redirecionamento ao login e a rota de retorno sem sessão',()=>{
  render(<ProtectedDashboard/>)
  expect(screen.getByText('Login: /app?period=month')).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
 })
})
