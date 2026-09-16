import { Navigate,Outlet,useLocation } from 'react-router-dom'
import { AuthLoading } from '../components/auth/AuthLoading'
import { useAuth } from '../hooks/useAuth'
export function ProtectedRoute(){const {user,loading}=useAuth(),location=useLocation();if(loading)return <AuthLoading/>;if(!user)return <Navigate to="/entrar" replace state={{from:`${location.pathname}${location.search}`}}/>;return <Outlet/>}
