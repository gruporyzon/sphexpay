import { Navigate,Outlet,useLocation } from 'react-router-dom'
import { AuthLoading } from '../components/auth/AuthLoading'
import { useAuth } from '../hooks/useAuth'

// Sem abertura animada: o painel aparece assim que a sessão é validada. A tela de carregamento só
// aparece enquanto a sessão ainda está sendo verificada.
export function ProtectedRoute(){
 const {user,loading}=useAuth(),location=useLocation()
 if(loading)return <AuthLoading/>
 if(!user)return <Navigate to="/entrar" replace state={{from:`${location.pathname}${location.search}`}}/>
 return <Outlet/>
}
