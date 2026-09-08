import { Navigate,Outlet,useLocation } from 'react-router-dom'
import { AuthLoading } from '../components/auth/AuthLoading'
import { useAuth } from '../hooks/useAuth'

// Guard de rota que exige verificação em duas etapas concluída (AAL2) quando a
// conta tem MFA ativo. Contas sem MFA passam direto — o enforcement só se aplica
// a quem optou pelo segundo fator. Usado nas rotas mais sensíveis (saques,
// integrações). Não envolver Configurações: é onde o próprio MFA é gerenciado.
export function RequireAAL2(){
 const {loading,user,aal,mfaRequired}=useAuth()
 const location=useLocation()
 if(loading)return <AuthLoading/>
 if(!user)return <Navigate to="/entrar" replace state={{from:`${location.pathname}${location.search}`}}/>
 if(mfaRequired){
  return <Navigate to="/entrar" replace state={{from:`${location.pathname}${location.search}`,mfa:true}}/>
 }
 // aal.current pode ser null em ambientes sem Supabase configurado — nesse caso
 // não bloqueia (produto demonstrativo permanece utilizável).
 if(aal?.next==='aal2'&&aal?.current!=='aal2'){
  return <Navigate to="/entrar" replace state={{from:`${location.pathname}${location.search}`,mfa:true}}/>
 }
 return <Outlet/>
}
