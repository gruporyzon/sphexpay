import { BrowserRouter,Navigate,Route,Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Dashboard from './pages/Dashboard'
import { ProductsPage } from './pages/Commerce'
import { CheckoutPage,LinksPage,WithdrawalsPage } from './pages/Operations'
import Settings from './pages/Settings'
import NotificationsPage from './pages/Notifications'
import AssistantPage from './pages/Assistant'
import AwardsPage from './pages/Awards'
import LiveReports from './pages/LiveReports'
import FinancialHub from './pages/FinancialHub'
import { EditableCustomers,EditableSubscriptions } from './pages/EditableRecords'
import LiveSales from './pages/LiveSales'
import LandingPage from './pages/public/LandingPage'
import LegalPage from './pages/public/LegalPage'
import LoginPage from './pages/auth/LoginPage'
import SignupPage from './pages/auth/SignupPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import VerifyEmailPage from './pages/auth/VerifyEmailPage'
import AuthCallbackPage from './pages/auth/AuthCallbackPage'
import OnboardingPage from './pages/onboarding/OnboardingPage'
import Showcase from './pages/Showcase'
import Integrations from './pages/Integrations'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { PublicOnlyRoute } from './routes/PublicOnlyRoute'
import { SoundProvider } from './providers/SoundProvider'

const modules=[['vendas',<LiveSales/>],['transacoes',<LiveSales transactions/>],['produtos',<ProductsPage/>],['vitrine',<Showcase/>],['assinaturas',<EditableSubscriptions/>],['clientes',<EditableCustomers/>],['checkout',<CheckoutPage/>],['links',<LinksPage/>],['financeiro',<FinancialHub/>],['saques',<WithdrawalsPage/>],['integracoes',<Integrations/>],['premiacoes',<AwardsPage/>],['assistente',<AssistantPage/>],['relatorios',<LiveReports/>],['notificacoes',<NotificationsPage/>],['configuracoes',<Settings/>]] as const
export default function App(){return <BrowserRouter><Routes>
 <Route path="/" element={<LandingPage/>}/>
 <Route path="/termos" element={<LegalPage type="terms"/>}/>
 <Route path="/privacidade" element={<LegalPage type="privacy"/>}/>
 <Route element={<PublicOnlyRoute/>}><Route path="/entrar" element={<LoginPage/>}/><Route path="/criar-conta" element={<SignupPage/>}/><Route path="/recuperar-senha" element={<ForgotPasswordPage/>}/><Route path="/verificar-email" element={<VerifyEmailPage/>}/></Route>
 <Route path="/nova-senha" element={<ResetPasswordPage/>}/><Route path="/auth/callback" element={<AuthCallbackPage/>}/>
 <Route element={<ProtectedRoute/>}><Route path="/onboarding" element={<OnboardingPage/>}/><Route path="/app" element={<SoundProvider><Layout/></SoundProvider>}><Route index element={<Dashboard/>}/>{modules.map(([path,element])=><Route path={path} element={element} key={path}/>)}<Route path="*" element={<Navigate to="/app" replace/>}/></Route>{modules.map(([path])=><Route path={`/${path}`} element={<Navigate to={`/app/${path}`} replace/>} key={`legacy-${path}`}/>)}<Route path="/dashboard" element={<Navigate to="/app" replace/>}/><Route path="/visao-geral" element={<Navigate to="/app" replace/>}/></Route>
 <Route path="*" element={<Navigate to="/" replace/>}/>
 </Routes></BrowserRouter>}
