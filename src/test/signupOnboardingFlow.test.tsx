import { MemoryRouter,Route,Routes,useLocation } from 'react-router-dom'
import { render,screen,waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach,describe,expect,it,vi } from 'vitest'
import OnboardingPage from '../pages/onboarding/OnboardingPage'
import { KycCompletionPrompt } from '../features/kyc/KycCompletionPrompt'
import { questionnaire } from '../features/signup/questionnaire'

const mocks=vi.hoisted(()=>({
 user:{id:'user-1',user_metadata:{full_name:'Maria Souza',onboarding_complete:false}} as {id:string;user_metadata:Record<string,unknown>},
 save:vi.fn(),overview:vi.fn()
}))
vi.mock('../hooks/useAuth',()=>({useAuth:()=>({user:mocks.user,loading:false,configured:true})}))
vi.mock('../features/signup/onboardingService',()=>({onboardingService:{save:mocks.save},notifyTeam:vi.fn()}))
vi.mock('../features/kyc/kycService',()=>({kycService:{overview:mocks.overview}}))

const Where=()=><output data-testid="where">{useLocation().pathname}</output>
const renderAt=(element:React.ReactNode,path:string)=>render(<MemoryRouter initialEntries={[path]}><Routes><Route path="*" element={<>{element}<Where/></>}/></Routes></MemoryRouter>)
const answers=['Infoprodutos','Educação','Até R$ 10 mil','Começar a vender','Instagram']

describe('questionário inicial da conta',()=>{
 beforeEach(()=>{sessionStorage.clear();mocks.save.mockReset().mockResolvedValue(undefined);mocks.user={id:'user-1',user_metadata:{full_name:'Maria Souza',onboarding_complete:false}}})

 it('segue as 5 etapas com as perguntas da referência e só avança com uma opção marcada',async()=>{
  const user=userEvent.setup();renderAt(<OnboardingPage/>,'/onboarding')
  expect(questionnaire.map(item=>item.title)).toEqual(['Qual tipo de negócio você opera?','Qual é o segmento principal do seu negócio?','Qual seu faturamento mensal aproximado?','Qual é o seu principal objetivo com a SphexPay?','Como você chegou até nós?'])
  expect(screen.getByText('Etapa 1 de 5')).toBeInTheDocument()
  expect(screen.getByRole('progressbar',{name:'Progresso do cadastro'})).toHaveAttribute('aria-valuenow','1')
  expect(screen.getByRole('button',{name:/Voltar/})).toBeDisabled()
  expect(screen.getByRole('button',{name:/Próximo/})).toBeDisabled()
  expect(screen.getAllByRole('radio')).toHaveLength(8)
  await user.click(screen.getByText('Infoprodutos'))
  await user.click(screen.getByRole('button',{name:/Próximo/}))
  expect(screen.getByRole('heading',{name:'Qual é o segmento principal do seu negócio?'})).toHaveFocus()
  expect(screen.getByText('Etapa 2 de 5')).toBeInTheDocument()
  await user.click(screen.getByRole('button',{name:/Voltar/}))
  expect(screen.getByRole('radio',{name:'Infoprodutos'})).toBeChecked()
 })

 it('salva as respostas, mostra a conclusão e leva ao painel',async()=>{
  const user=userEvent.setup();renderAt(<OnboardingPage/>,'/onboarding')
  for(const [index,label] of answers.entries()){
   await user.click(screen.getByText(label))
   await user.click(screen.getByRole('button',{name:index===answers.length-1?/Concluir/:/Próximo/}))
  }
  expect(mocks.save).toHaveBeenCalledWith('user-1',{business_type:'infoprodutos',segment:'educacao',monthly_revenue:'ate_10k',goal:'comecar_a_vender',acquisition_channel:'instagram'})
  expect(await screen.findByRole('heading',{name:'Tudo pronto, Maria.'})).toBeInTheDocument()
  expect(screen.getByRole('progressbar',{name:'Progresso do cadastro'})).toHaveAttribute('aria-valuenow','5')
  await user.click(screen.getByRole('button',{name:/Acessar painel/}))
  expect(screen.getByTestId('where')).toHaveTextContent('/app')
 })

 it('mantém a etapa ao recarregar e mostra erro sem perder as respostas',async()=>{
  mocks.save.mockRejectedValue(new Error('Não foi possível salvar suas respostas. Tente novamente.'))
  sessionStorage.setItem('sphexpay:onboarding-draft:user-1',JSON.stringify({business_type:'saas',segment:'tecnologia',monthly_revenue:'10k_50k',goal:'vender_exterior'}))
  const user=userEvent.setup();renderAt(<OnboardingPage/>,'/onboarding')
  expect(screen.getByText('Etapa 5 de 5')).toBeInTheDocument()
  await user.click(screen.getByText('Google'));await user.click(screen.getByRole('button',{name:/Concluir/}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar suas respostas')
  expect(screen.getByRole('radio',{name:'Google'})).toBeChecked()
 })

 it('não repete o questionário para quem já concluiu',()=>{
  mocks.user={id:'user-1',user_metadata:{onboarding_complete:true}};renderAt(<OnboardingPage/>,'/onboarding')
  expect(screen.getByTestId('where')).toHaveTextContent('/app')
 })
})

describe('lembrete de verificação no painel',()=>{
 beforeEach(()=>{sessionStorage.clear();mocks.overview.mockReset()})

 it('pede para concluir a verificação e leva ao módulo',async()=>{
  mocks.overview.mockResolvedValue({profile:null,documents:[]})
  const user=userEvent.setup();renderAt(<KycCompletionPrompt/>,'/app')
  const dialog=await screen.findByRole('dialog',{name:'Conclua sua verificação'})
  expect(dialog).toHaveAttribute('aria-modal','true')
  expect(screen.getByRole('button',{name:/Concluir verificação/})).toHaveFocus()
  await user.click(screen.getByRole('button',{name:/Concluir verificação/}))
  expect(screen.getByTestId('where')).toHaveTextContent('/app/verificacao')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
 })

 it('fecha com Esc e não reaparece na mesma sessão',async()=>{
  mocks.overview.mockResolvedValue({profile:{status:'needs_more_info'},documents:[]})
  const user=userEvent.setup();const view=renderAt(<KycCompletionPrompt/>,'/app')
  expect(await screen.findByRole('dialog',{name:'Sua verificação precisa de ajustes'})).toBeInTheDocument()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  view.unmount();renderAt(<KycCompletionPrompt/>,'/app')
  await waitFor(()=>expect(mocks.overview).toHaveBeenCalledTimes(1))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
 })

 it.each(['pending','approved'] as const)('não incomoda quem está com verificação %s',async status=>{
  mocks.overview.mockResolvedValue({profile:{status},documents:[]})
  renderAt(<KycCompletionPrompt/>,'/app')
  await waitFor(()=>expect(mocks.overview).toHaveBeenCalled())
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
 })
})
