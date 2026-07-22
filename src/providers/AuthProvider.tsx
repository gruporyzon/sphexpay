import { useEffect,useMemo,useState,type PropsWithChildren } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured,supabase } from '../lib/supabase'
import { authService,clearSessionPersistence,shouldEndTemporarySession } from '../services/authService'
import { AuthContext,type AuthContextValue } from './authContext'

export function AuthProvider({children}:PropsWithChildren){
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true)
 useEffect(()=>{const client=supabase;if(!client){setLoading(false);return}let mounted=true;const initialize=async()=>{try{const {data,error}=await client.auth.getSession();if(error)throw error;if(shouldEndTemporarySession()){await client.auth.signOut({scope:'local'});clearSessionPersistence();if(mounted)setSession(null)}else if(mounted)setSession(data.session)}catch{if(mounted)setSession(null)}finally{if(mounted)setLoading(false)}};void initialize();const {data}=client.auth.onAuthStateChange((_event,next)=>{if(mounted){setSession(next);setLoading(false)}});return()=>{mounted=false;data.subscription.unsubscribe()}},[])
 const value=useMemo<AuthContextValue>(()=>({session,user:session?.user??null,loading,configured:isSupabaseConfigured,signOut:async()=>{try{await authService.signOut()}finally{setSession(null)}}}),[session,loading])
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
