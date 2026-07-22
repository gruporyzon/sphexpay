import { Navigate,Outlet } from 'react-router-dom'
import { AuthLoading } from '../components/auth/AuthLoading'
import { useAuth } from '../hooks/useAuth'
export function PublicOnlyRoute(){const {user,loading}=useAuth();if(loading)return <AuthLoading/>;return user?<Navigate to={user.user_metadata?.onboarding_complete?'/app':'/onboarding'} replace/>:<Outlet/>}
