import { lazy,Suspense } from 'react'
import { BrowserRouter,Navigate,Route,Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Dashboard from './pages/Dashboard'
import { CheckoutPage,LinksPage,WithdrawalsPage } from './pages/Operations'
import Settings from './pages/Settings'
import NotificationsPage from './pages/Notifications'
import DemoAwareAwards from './pages/DemoAwards'
import LiveReports from './pages/LiveReports'
import FinancialHub from './pages/FinancialHub'
import { EditableSubscriptions } from './pages/EditableRecords'
import DemoAwareCustomers from './pages/DemoCustomers'
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
import CompetitionPage from './pages/Competition'
import { DashboardDataProvider } from './providers/DashboardDataProvider'
import { Loading } from './components/ui'
import DevDashboardPreview from './pages/DevDashboardPreview'
import DevLiveSalesPreview from './pages/DevLiveSalesPreview'
import DevTransactionsPreview from './pages/DevTransactionsPreview'
import DevProductsPreview from './pages/DevProductsPreview'
import DevCustomersPreview from './pages/DevCustomersPreview'
import DevFinancePreview from './pages/DevFinancePreview'
import DevNotificationsPreview from './pages/DevNotificationsPreview'
import { DevPreviewNavigator } from './components/dev/DevPreviewNavigator'
import DevSettingsPreview from './pages/DevSettingsPreview'

const LiveSalesWorld=lazy(()=>import('./pages/LiveSalesWorld'))
const ProductsV2Page=lazy(()=>import('./features/products/ProductsV2').then(m=>({default:m.ProductsV2Page})))
const ProductEditorPage=lazy(()=>import('./features/products/ProductsV2').then(m=>({default:m.ProductEditorPage})))
const MembersProductPage=lazy(()=>import('./features/products/ProductAdvanced').then(m=>({default:m.MembersProductPage})))
const CheckoutBuilderPage=lazy(()=>import('./features/products/CheckoutStudio').then(m=>({default:m.CheckoutBuilderPage})))
const CheckoutPreviewPage=lazy(()=>import('./features/products/CheckoutStudio').then(m=>({default:m.CheckoutPreviewPage})))

const modules=[['competicao',<CompetitionPage/>],['vendas-ao-vivo',<Suspense fallback={<Loading/>}><LiveSalesWorld/></Suspense>],['vendas',<LiveSales/>],['transacoes',<LiveSales transactions/>],['produtos',<Deferred><ProductsV2Page/></Deferred>],['vitrine',<Showcase/>],['assinaturas',<EditableSubscriptions/>],['clientes',<DemoAwareCustomers/>],['checkout',<CheckoutPage/>],['links',<LinksPage/>],['financeiro',<FinancialHub/>],['saques',<WithdrawalsPage/>],['integracoes',<Integrations/>],['premiacoes',<DemoAwareAwards/>],['relatorios',<LiveReports/>],['notificacoes',<NotificationsPage/>],['configuracoes',<Settings/>]] as const
export default function App(){return <BrowserRouter><Routes>
 {import.meta.env.DEV&&<Route path="/dev/dashboard-preview" element={<><DevPreviewNavigator/><DevDashboardPreview/></>}/>}
 {import.meta.env.DEV&&<Route path="/dev/live-sales-preview" element={<><DevPreviewNavigator/><DevLiveSalesPreview/></>}/>}
 {import.meta.env.DEV&&<Route path="/dev/transactions-preview" element={<><DevPreviewNavigator/><DevTransactionsPreview/></>}/>}
 {import.meta.env.DEV&&<Route path="/dev/products-preview" element={<><DevPreviewNavigator/><DevProductsPreview/></>}/>}
 {import.meta.env.DEV&&<Route path="/dev/customers-preview" element={<><DevPreviewNavigator/><DevCustomersPreview/></>}/>}
 {import.meta.env.DEV&&<Route path="/dev/finance-preview" element={<><DevPreviewNavigator/><DevFinancePreview/></>}/>}
 {import.meta.env.DEV&&<Route path="/dev/notifications-preview" element={<><DevPreviewNavigator/><DevNotificationsPreview/></>}/>}
 {import.meta.env.DEV&&<Route path="/dev/settings-preview" element={<><DevPreviewNavigator/><DevSettingsPreview/></>}/>}
 <Route path="/" element={<LandingPage/>}/>
 <Route path="/termos" element={<LegalPage type="terms"/>}/>
 <Route path="/privacidade" element={<LegalPage type="privacy"/>}/>
 <Route element={<PublicOnlyRoute/>}><Route path="/entrar" element={<LoginPage/>}/><Route path="/criar-conta" element={<SignupPage/>}/><Route path="/recuperar-senha" element={<ForgotPasswordPage/>}/><Route path="/verificar-email" element={<VerifyEmailPage/>}/></Route>
 <Route path="/nova-senha" element={<ResetPasswordPage/>}/><Route path="/auth/callback" element={<AuthCallbackPage/>}/>
 <Route element={<ProtectedRoute/>}><Route path="/onboarding" element={<OnboardingPage/>}/><Route path="/app" element={<DashboardDataProvider><SoundProvider><Layout/></SoundProvider></DashboardDataProvider>}><Route index element={<Dashboard/>}/>{modules.map(([path,element])=><Route path={path} element={element} key={path}/>)}<Route path="produtos/:productId/checkout/:checkoutId/builder" element={<Deferred><CheckoutBuilderPage/></Deferred>}/><Route path="produtos/:productId/checkout/:checkoutId/preview" element={<Deferred><CheckoutPreviewPage/></Deferred>}/><Route path="produtos/:id/:section" element={<Deferred><ProductEditorPage/></Deferred>}/><Route path="members/products/:id" element={<Deferred><MembersProductPage/></Deferred>}/><Route path="products" element={<Navigate to="/app/produtos" replace/>}/><Route path="products/:id/:section" element={<Deferred><ProductEditorPage/></Deferred>}/><Route path="*" element={<Navigate to="/app" replace/>}/></Route>{modules.map(([path])=><Route path={`/${path}`} element={<Navigate to={`/app/${path}`} replace/>} key={`legacy-${path}`}/>)}<Route path="/dashboard/products" element={<Navigate to="/app/produtos" replace/>}/><Route path="/dashboard/products/:productId/checkout/:checkoutId/:mode" element={<NavigateProductAlias/>}/><Route path="/dashboard/products/:id/:section" element={<NavigateProductAlias/>}/><Route path="/dashboard/members/products/:id" element={<NavigateMembersAlias/>}/><Route path="/dashboard" element={<Navigate to="/app" replace/>}/><Route path="/visao-geral" element={<Navigate to="/app" replace/>}/></Route>
 <Route path="*" element={<Navigate to="/" replace/>}/>
 </Routes></BrowserRouter>}

function NavigateProductAlias(){const path=window.location.pathname.replace('/dashboard/products','/app/produtos');return <Navigate to={path} replace/>}
function NavigateMembersAlias(){const path=window.location.pathname.replace('/dashboard/members','/app/members');return <Navigate to={path} replace/>}
function Deferred({children}:{children:React.ReactNode}){return <Suspense fallback={<Loading/>}>{children}</Suspense>}
