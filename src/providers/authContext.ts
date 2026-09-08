import { createContext } from 'react'
import type { Session,User } from '@supabase/supabase-js'
export interface AuthContextValue{
 session:Session|null
 user:User|null
 loading:boolean
 configured:boolean
 // Nível de garantia de autenticação (MFA). aal2 = usuário concluiu o segundo fator.
 aal:{current:string|null;next:string|null}
 // true quando a conta tem MFA ativo mas a sessão ainda está em aal1.
 mfaRequired:boolean
 refreshAssurance:()=>Promise<void>
 signOut:()=>Promise<void>
}
export const AuthContext=createContext<AuthContextValue|undefined>(undefined)
