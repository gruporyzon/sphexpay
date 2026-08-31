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

 it('abre Aparência, indica e aplica light, dark e system sem reload',async()=>{
  let systemListener:(event:MediaQueryListEvent)=>void=()=>undefined
  const media={matches:true,media:'(prefers-color-scheme: dark)',onchange:null,addListener:vi.fn(),removeListener:vi.fn(),addEventListener:vi.fn((_type:string,listener:(event:MediaQueryListEvent)=>void)=>{systemListener=listener}),removeEventListener:vi.fn(),dispatchEvent:vi.fn()}
  vi.mocked(window.matchMedia).mockReturnValue(media as unknown as MediaQueryList)
  renderMenu();const user=await openMenu();const appearance=screen.getByRole('menuitem',{name:'Aparência'})
  await user.click(appearance);let submenu=screen.getByRole('menu',{name:'Aparência'})
  expect(within(submenu).getByRole('menuitemradio',{name:'Modo claro'})).toHaveAttribute('aria-checked','true')
  await user.click(within(submenu).getByRole('menuitemradio',{name:'Modo escuro'}));expect(document.documentElement.dataset.theme).toBe('dark')
  await user.click(appearance);submenu=screen.getByRole('menu',{name:'Aparência'});await user.click(within(submenu).getByRole('menuitemradio',{name:'Seguir preferência do sistema'}))
  expect(useDemoStore.getState().themePreference).toBe('system');expect(document.documentElement.dataset.theme).toBe('dark')
  media.matches=false;act(()=>systemListener({matches:false} as MediaQueryListEvent));expect(document.documentElement.dataset.theme).toBe('light')
  await user.click(appearance);submenu=screen.getByRole('menu',{name:'Aparência'});expect(within(submenu).getByRole('menuitemradio',{name:'Seguir preferência do sistema'})).toHaveAttribute('aria-checked','true')
 })

 it('reutiliza as ações reais para outra conta e logout',async()=>{
  renderMenu();let user=await openMenu();await user.click(screen.getByRole('menuitem',{name:'Acessar outra conta'}));expect(signOut).toHaveBeenCalledWith('login')
  user=await openMenu();await user.click(screen.getByRole('menuitem',{name:'Sair da conta'}));expect(signOut).toHaveBeenCalledWith('home')
 })

 it('abre Aparência como subview contida no menu em mobile',async()=>{
  Object.defineProperty(window,'innerWidth',{configurable:true,value:390});renderMenu();const user=await openMenu();await user.click(screen.getByRole('menuitem',{name:'Aparência'}))
  const menu=screen.getByRole('menu',{name:'Menu do perfil'});expect(within(menu).getByRole('button',{name:'Voltar ao menu do perfil'})).toBeVisible();expect(document.querySelector('.profile-appearance-submenu')).not.toBeInTheDocument()
  await user.click(within(menu).getByRole('button',{name:'Voltar ao menu do perfil'}));expect(screen.getByRole('menuitem',{name:'Dashboard de produtor'})).toBeVisible()
 })

 it('inverte o submenu lateral conforme o espaço disponível',async()=>{
  renderMenu();await openMenu();const appearance=screen.getByRole('menuitem',{name:'Aparência'})
  vi.spyOn(appearance,'getBoundingClientRect').mockReturnValue({left:500} as DOMRect);fireEvent.mouseEnter(appearance);expect(document.querySelector('.profile-appearance-submenu')).toHaveClass('submenu-left')
  fireEvent.mouseLeave(document.querySelector('.profile-appearance-submenu')!);vi.spyOn(appearance,'getBoundingClientRect').mockReturnValue({left:120} as DOMRect);fireEvent.mouseEnter(appearance);expect(document.querySelector('.profile-appearance-submenu')).toHaveClass('submenu-right')
 })
})
