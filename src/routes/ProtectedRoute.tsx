import { Navigate,Outlet,useLocation } from 'react-router-dom'
import { AuthLoading } from '../components/auth/AuthLoading'
import { useAuth } from '../hooks/useAuth'
import { AuthEntranceExperience } from '../components/app-boot/AuthEntranceExperience'
export function ProtectedRoute(){const {user,loading}=useAuth(),location=useLocation();if(loading)return <AuthLoading/>;if(!user)return <Navigate to="/entrar" replace state={{from:`${location.pathname}${location.search}`}}/>;const content=<Outlet/>;return location.pathname.startsWith('/app')?<AuthEntranceExperience appReady>{content}</AuthEntranceExperience>:content}
