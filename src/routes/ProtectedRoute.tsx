import { useEffect,useState } from 'react'
import { Navigate,Outlet,useLocation } from 'react-router-dom'
import { AuthLoading } from '../components/auth/AuthLoading'
import { useAuth } from '../hooks/useAuth'

// A abertura roda sempre que o aplicativo é aberto, mesmo com a sessão já salva. O painel monta por
// baixo e já carrega os dados enquanto a animação termina; depois ela sai com um fade.
export const LAUNCH_SPLASH_MS=2600
export const LAUNCH_SPLASH_EXIT_MS=450
let launchSplashPending=true

export function ProtectedRoute(){
 const {user,loading}=useAuth(),location=useLocation()
 const [splash,setSplash]=useState<'show'|'leaving'|null>(()=>launchSplashPending?'show':null)
 useEffect(()=>{
  if(!launchSplashPending)return
  launchSplashPending=false
  const leave=window.setTimeout(()=>setSplash('leaving'),LAUNCH_SPLASH_MS),done=window.setTimeout(()=>setSplash(null),LAUNCH_SPLASH_MS+LAUNCH_SPLASH_EXIT_MS)
  return()=>{clearTimeout(leave);clearTimeout(done)}
 },[])
 if(!loading&&!user)return <Navigate to="/entrar" replace state={{from:`${location.pathname}${location.search}`}}/>
 return <>{(loading||splash)&&<AuthLoading key="launch" overlay={!loading} leaving={!loading&&splash==='leaving'}/>}{!loading&&<Outlet/>}</>
}
