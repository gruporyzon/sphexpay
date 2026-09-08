import { useCallback,useEffect,useMemo,useState,type PropsWithChildren } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseClientAvailable,supabase } from '../lib/supabase'
import { authService,clearSessionPersistence,mfaService,shouldEndTemporarySession } from '../services/authService'
import { AuthContext,type AuthContextValue } from './authContext'
import { clearAuthEntranceState } from '../lib/authEntranceState'

const emptyAssurance={current:null,next:null}

export function AuthProvider({children}:PropsWithChildren){
 const [session,setSession]=useState<Session|null>(null)
 const [loading,setLoading]=useState(true)
 const [aal,setAal]=useState<{current:string|null;next:string|null}>(emptyAssurance)

 const refreshAssurance=useCallback(async()=>{
  if(!supabase){setAal(emptyAssurance);return}
  const level=await mfaService.assuranceLevel()
  setAal({current:level.currentLevel,next:level.nextLevel})
 },[])

 useEffect(()=>{
  const client=supabase
  if(!client){setLoading(false);return}
  let mounted=true
  const initialize=async()=>{
   try{
    const {data,error}=await client.auth.getSession()
    if(error)throw error
    if(shouldEndTemporarySession()){
     await client.auth.signOut({scope:'local'})
     clearSessionPersistence()
     if(mounted)setSession(null)
    }else if(mounted){
     setSession(data.session)
    }
   }catch{
    if(mounted)setSession(null)
   }finally{
    if(mounted){await refreshAssurance();setLoading(false)}
   }
  }
  void initialize()
  const {data}=client.auth.onAuthStateChange((_event,next)=>{
   if(!mounted)return
   setSession(next)
   setLoading(false)
   void refreshAssurance()
  })
  return()=>{mounted=false;data.subscription.unsubscribe()}
 },[refreshAssurance])

 const value=useMemo<AuthContextValue>(()=>({
  session,
  user:session?.user??null,
  loading,
  configured:isSupabaseClientAvailable,
  aal,
  mfaRequired:aal.next==='aal2'&&aal.current!=='aal2',
  refreshAssurance,
  signOut:async()=>{try{await authService.signOut()}finally{clearAuthEntranceState();setSession(null);setAal(emptyAssurance)}}
 }),[session,loading,aal,refreshAssurance])

 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
