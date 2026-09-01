import {act,fireEvent,render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {MemoryRouter} from 'react-router-dom'
import {beforeEach,describe,expect,it,vi} from 'vitest'
import {MobileAppDock} from '../components/mobile-navigation/MobileAppDock'
import {mobileNavigationIndex,navigationItems,primaryMobileNavigation,remainingMobileNavigation} from '../config/navigation'
import {useDemoStore} from '../store/useDemoStore'

describe('navegação mobile',()=>{
 beforeEach(()=>{vi.mocked(window.matchMedia).mockImplementation(query=>({matches:query.includes('max-width'),media:query,onchange:null,addListener:vi.fn(),removeListener:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn(),dispatchEvent:vi.fn()}));act(()=>useDemoStore.getState().reset())})
 it('identifica a posição ativa por rota e subrota',()=>{expect(mobileNavigationIndex('/app')).toBe(2);expect(mobileNavigationIndex('/app/relatorios/clientes')).toBe(0);expect(mobileNavigationIndex('/app/financeiro/saques')).toBe(1);expect(mobileNavigationIndex('/app/social/explore')).toBe(3);expect(mobileNavigationIndex('/app/assinaturas')).toBe(4)})
 it('descobre os módulos restantes a partir da configuração compartilhada',()=>{expect(primaryMobileNavigation.map(item=>item.label)).toEqual(['Relatórios','Financeiro','Dashboard','Social']);expect(remainingMobileNavigation.map(item=>item.label)).toContain('Assinaturas');for(const primary of primaryMobileNavigation)expect(remainingMobileNavigation).not.toContainEqual(primary);expect(navigationItems.map(item=>item.label)).toContain('Produtos')})
 it('abre e fecha o sheet Mais preservando a navegação acessível',async()=>{const user=userEvent.setup();render(<MemoryRouter initialEntries={['/app/assinaturas']}><MobileAppDock/></MemoryRouter>);expect(screen.getByRole('button',{name:'Mais módulos',hidden:true})).toHaveAttribute('aria-current','page');await user.click(screen.getByRole('button',{name:'Mais módulos',hidden:true}));expect(screen.getByRole('dialog',{name:'Mais módulos',hidden:true})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Assinaturas',hidden:true})).toBeInTheDocument();fireEvent.keyDown(window,{key:'Escape'});await act(async()=>Promise.resolve());expect(screen.queryByRole('dialog',{name:'Mais módulos',hidden:true})).not.toBeInTheDocument()})
 it('persiste a opacidade dentro das preferências existentes',()=>{act(()=>useDemoStore.getState().updatePreferences('mobileNavigation',{opacity:67}));expect(useDemoStore.getState().preferences.mobileNavigation.opacity).toBe(67);const persisted=JSON.parse(localStorage.getItem('sphexpay-demo-v1')||'{}');expect(persisted.state.preferences.mobileNavigation.opacity).toBe(67)})
})
