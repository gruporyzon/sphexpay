import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {beforeEach,describe,expect,it,vi} from 'vitest'
import SubscriptionsPage from '../features/subscriptions/SubscriptionsPage'
import {subscriptionService} from '../features/subscriptions/subscriptionService'

vi.mock('../hooks/useAuth',()=>({useAuth:()=>({user:{id:'seller-test'}})}))
const records=[{id:'SUB-001',customerId:'CUS-1',customerName:'Ana Silva',customerEmail:'ana@sphex.test',productId:'PROD-1',productName:'Clube Premium',status:'active' as const,createdAt:'2026-08-03T12:00:00.000Z',currentPeriodEnd:'2026-09-03T12:00:00.000Z',cancelledAt:null,statusChangedAt:'2026-08-03T12:00:00.000Z'}]

describe('módulo Assinaturas',()=>{
 beforeEach(()=>vi.spyOn(subscriptionService,'load').mockResolvedValue({items:records,products:[{id:'PROD-1',name:'Clube Premium'}],truncated:false}))
 it('renderiza a visão geral com dados persistidos normalizados',async()=>{render(<SubscriptionsPage/>);expect(screen.getByRole('heading',{name:'Assinaturas'})).toBeInTheDocument();expect(await screen.findByText('Assinaturas ativas')).toBeInTheDocument();expect(screen.getByText('Novos assinantes')).toBeInTheDocument();expect(screen.getByText('Assinaturas canceladas')).toBeInTheDocument();expect(screen.getByText('Assinaturas inativadas')).toBeInTheDocument()})
 it('abre a gestão, busca e exporta os resultados filtrados',async()=>{const user=userEvent.setup(),click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});render(<SubscriptionsPage/>);await waitFor(()=>expect(subscriptionService.load).toHaveBeenCalled());await user.click(screen.getByRole('button',{name:'Assinaturas'}));expect(screen.getByRole('columnheader',{name:'Cliente'})).toBeInTheDocument();expect(screen.getAllByText('Ana Silva').length).toBeGreaterThan(0);await user.type(screen.getByRole('textbox',{name:'Buscar assinaturas'}),'inexistente');await waitFor(()=>expect(screen.getByText('Nenhum resultado encontrado')).toBeInTheDocument());fireEvent.change(screen.getByRole('textbox',{name:'Buscar assinaturas'}),{target:{value:''}});await waitFor(()=>expect(screen.getAllByText('Ana Silva').length).toBeGreaterThan(0));await user.click(screen.getByRole('button',{name:'Exportar'}));expect(click).toHaveBeenCalled();click.mockRestore()})
})
