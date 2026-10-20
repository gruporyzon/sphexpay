import { act,fireEvent,render,screen,within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter,useLocation } from 'react-router-dom'
import { beforeEach,describe,expect,it,vi } from 'vitest'
import { ProfileMenu } from '../components/profile/ProfileMenu'
import { useDemoStore } from '../store/useDemoStore'

vi.mock('../components/profile/ProfileAvatar',()=>({ProfileAvatar:()=> <span className="profile-photo" data-testid="profile-avatar">RR</span>}))

const signOut=vi.fn(async()=>undefined)
const Location=()=>{const location=useLocation();return <output data-testid="location">{location.pathname}{location.search}</output>}
const renderMenu=()=>render(<MemoryRouter initialEntries={['/app']}><ProfileMenu name="Ronaldy Rodríguez" email="ronaldy@sphexpay.com" onSignOut={signOut}/><Location/></MemoryRouter>)
const openMenu=async()=>{const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'Abrir menu do perfil'}));return user}

describe('menu premium de perfil',()=>{
 beforeEach(()=>{localStorage.clear();signOut.mockClear();act(()=>useDemoStore.getState().reset());Object.defineProperty(window,'innerWidth',{configurable:true,value:1280})})

 it('abre pelo avatar, mostra o usuário e fecha por clique externo e ESC',async()=>{
  const user=userEvent.setup();renderMenu();const trigger=screen.getByRole('button',{name:'Abrir menu do perfil'})
  expect(within(trigger).getByTestId('profile-avatar')).toBeInTheDocument();await user.click(trigger)
  const menu=screen.getByRole('menu',{name:'Menu do perfil'});expect(menu).toBeVisible();expect(within(menu).getByText('Ronaldy Rodríguez')).toBeVisible()
  fireEvent.pointerDown(document.body);expect(screen.queryByRole('menu',{name:'Menu do perfil'})).not.toBeInTheDocument()
  await user.click(trigger);await user.keyboard('{Escape}');expect(screen.queryByRole('menu',{name:'Menu do perfil'})).not.toBeInTheDocument();expect(trigger).toHaveFocus()
 })

 it.each([['Dashboard de produtor','/app'],['Configurações','/app/configuracoes'],['Acessar minhas compras','/app/vendas']])('navega por %s usando as rotas existentes',async(label,path)=>{
  renderMenu();const user=await openMenu();await user.click(screen.getByRole('menuitem',{name:label}));expect(screen.getByTestId('location')).toHaveTextContent(path)
 })

 it('leva a aparência para Preferências sem mostrar controles de tema no perfil',async()=>{renderMenu();const user=await openMenu();expect(screen.queryByRole('menuitem',{name:'Aparência'})).not.toBeInTheDocument();await user.click(screen.getByRole('menuitem',{name:'Preferências'}));expect(screen.getByTestId('location')).toHaveTextContent('/app/configuracoes?secao=Preferências')})

 it('reutiliza as ações reais para outra conta e logout',async()=>{
  renderMenu();let user=await openMenu();await user.click(screen.getByRole('menuitem',{name:'Acessar outra conta'}));expect(signOut).toHaveBeenCalledWith('login')
  user=await openMenu();await user.click(screen.getByRole('menuitem',{name:'Sair da conta'}));expect(signOut).toHaveBeenCalledWith('home')
 })

 it('mantém o acesso a Preferências dentro do menu em mobile',async()=>{Object.defineProperty(window,'innerWidth',{configurable:true,value:320});renderMenu();const user=await openMenu();expect(screen.queryByRole('menu',{name:'Aparência'})).not.toBeInTheDocument();await user.click(screen.getByRole('menuitem',{name:'Preferências'}));expect(screen.getByTestId('location')).toHaveTextContent('secao=Preferências')})
})
