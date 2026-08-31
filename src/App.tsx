import { lazy,Suspense,useLayoutEffect } from 'react'
import { BrowserRouter,Navigate,Route,Routes,useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import Dashboard from './pages/Dashboard'
import { CheckoutPage,LinksPage } from './pages/Operations'
import ProductsHub from './pages/ProductsHub'
import Settings from './pages/Settings'
import NotificationsPage from './pages/Notifications'
import DemoAwareAwards from './pages/DemoAwards'
import ReportsModule from './pages/LiveReports'
import FinancialHub,{ FinancialOverview } from './pages/FinancialHub'
import WithdrawalsSection from './pages/Withdrawals'
import { EditableSubscriptions } from './pages/EditableRecords'
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
import { useDemoStore } from './store/useDemoStore'
import { syncSystemChrome } from './lib/systemChrome'

const LiveSalesWorld=lazy(()=>import('./pages/LiveSalesWorld'))
const ProductsV2Page=lazy(()=>import('./features/products/ProductsV2').then(m=>({default:m.ProductsV2Page})))
const ProductEditorPage=lazy(()=>import('./features/products/ProductsV2').then(m=>({default:m.ProductEditorPage})))
const MembersProductPage=lazy(()=>import('./features/products/ProductAdvanced').then(m=>({default:m.MembersProductPage})))
const CheckoutBuilderPage=lazy(()=>import('./features/products/CheckoutStudio').then(m=>({default:m.CheckoutBuilderPage})))
const CheckoutPreviewPage=lazy(()=>import('./features/products/CheckoutStudio').then(m=>({default:m.CheckoutPreviewPage})))
const SocialPage=lazy(()=>import('./features/social/SocialPage'))

function SystemChrome(){
 const {pathname}=useLocation(),theme=useDemoStore(state=>state.theme)
 useLayoutEffect(()=>syncSystemChrome(pathname,theme),[pathname,theme])
 return null
}

const modules=[['competicao',<CompetitionPage/>],['vendas-ao-vivo',<Suspense fallback={<Loading/>}><LiveSalesWorld/></Suspense>],['vendas',<LiveSales/>],['vendas/:transactionId',<LiveSales/>],['transacoes/*',<NavigateTransactionsAlias/>],['produtos',<ProductsHub><Deferred><ProductsV2Page/></Deferred></ProductsHub>],['produtos/checkout',<ProductsHub><CheckoutPage/></ProductsHub>],['produtos/checkout/:checkoutId',<ProductsHub><CheckoutPage/></ProductsHub>],['produtos/links',<ProductsHub><LinksPage/></ProductsHub>],['produtos/links/:linkId',<ProductsHub><LinksPage/></ProductsHub>],['checkout/*',<NavigateOperationsAlias destination="checkout"/>],['links/*',<NavigateOperationsAlias destination="links"/>],['links-de-pagamento/*',<NavigateOperationsAlias destination="links"/>],['vitrine',<Showcase/>],['assinaturas',<EditableSubscriptions/>],['integracoes',<Integrations/>],['premiacoes',<DemoAwareAwards/>],['relatorios',<ReportsModule/>],['relatorios/clientes',<ReportsModule/>],['clientes/*',<Navigate to="/app/relatorios/clientes" replace/>],['notificacoes',<NotificationsPage/>],['configuracoes',<Settings/>]] as const
export default function App(){return <BrowserRouter><SystemChrome/><Routes>
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
 <Route element={<ProtectedRoute/>}><Route path="/onboarding" element={<OnboardingPage/>}/><Route path="/app" element={<DashboardDataProvider><SoundProvider><Layout/></SoundProvider></DashboardDataProvider>}><Route index element={<Dashboard/>}/>{modules.map(([path,element])=><Route path={path} element={element} key={path}/>)}<Route path="financeiro" element={<FinancialHub/>}><Route index element={<FinancialOverview/>}/><Route path="saques" element={<WithdrawalsSection/>}/></Route><Route path="saques" element={<Navigate to="/app/financeiro/saques" replace/>}/><Route path="social" element={<Deferred><SocialPage/></Deferred>}/><Route path="social/explore" element={<Deferred><SocialPage/></Deferred>}/><Route path="social/notifications" element={<Deferred><SocialPage/></Deferred>}/><Route path="social/messages" element={<Deferred><SocialPage/></Deferred>}/><Route path="social/saved" element={<Deferred><SocialPage/></Deferred>}/><Route path="social/ranking" element={<Deferred><SocialPage/></Deferred>}/><Route path="social/post/:id" element={<Deferred><SocialPage/></Deferred>}/><Route path="social/:username" element={<Deferred><SocialPage/></Deferred>}/><Route path="social/tag/:tag" element={<Deferred><SocialPage/></Deferred>}/><Route path="produtos/:productId/checkout/:checkoutId/builder" element={<Deferred><CheckoutBuilderPage/></Deferred>}/><Route path="produtos/:productId/checkout/:checkoutId/preview" element={<Deferred><CheckoutPreviewPage/></Deferred>}/><Route path="produtos/:id/:section" element={<Deferred><ProductEditorPage/></Deferred>}/><Route path="members/products/:id" element={<Deferred><MembersProductPage/></Deferred>}/><Route path="products" element={<Navigate to="/app/produtos" replace/>}/><Route path="products/:id/:section" element={<Deferred><ProductEditorPage/></Deferred>}/><Route path="*" element={<Navigate to="/app" replace/>}/></Route>{modules.map(([path])=><Route path={`/${path}`} element={<Navigate to={`/app/${path}`} replace/>} key={`legacy-${path}`}/>)}<Route path="/financeiro" element={<Navigate to="/app/financeiro" replace/>}/><Route path="/saques" element={<Navigate to="/app/financeiro/saques" replace/>}/><Route path="/dashboard/social/*" element={<NavigateSocialAlias/>}/><Route path="/dashboard/products" element={<Navigate to="/app/produtos" replace/>}/><Route path="/dashboard/products/:productId/checkout/:checkoutId/:mode" element={<NavigateProductAlias/>}/><Route path="/dashboard/products/:id/:section" element={<NavigateProductAlias/>}/><Route path="/dashboard/members/products/:id" element={<NavigateMembersAlias/>}/><Route path="/dashboard" element={<Navigate to="/app" replace/>}/><Route path="/visao-geral" element={<Navigate to="/app" replace/>}/></Route>
 <Route path="*" element={<Navigate to="/" replace/>}/>
 </Routes></BrowserRouter>}

function NavigateProductAlias(){const path=window.location.pathname.replace('/dashboard/products','/app/produtos');return <Navigate to={path} replace/>}
function NavigateMembersAlias(){const path=window.location.pathname.replace('/dashboard/members','/app/members');return <Navigate to={path} replace/>}
function NavigateSocialAlias(){const path=window.location.pathname.replace('/dashboard/social','/app/social');return <Navigate to={path} replace/>}
function NavigateTransactionsAlias(){const location=useLocation(),suffix=location.pathname.replace(/^\/app\/transacoes/,'');return <Navigate to={`/app/vendas${suffix}${location.search}`} replace/>}
function NavigateOperationsAlias({destination}:{destination:'checkout'|'links'}){const location=useLocation(),suffix=location.pathname.replace(/^\/app\/(?:checkout|links-de-pagamento|links)/,'');return <Navigate to={`/app/produtos/${destination}${suffix}${location.search}`} replace/>}
function Deferred({children}:{children:React.ReactNode}){return <Suspense fallback={<Loading/>}>{children}</Suspense>}
