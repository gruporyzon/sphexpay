import { createClient } from '@supabase/supabase-js'

const url=import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey=import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isSupabaseConfigured=Boolean(url&&anonKey)
export const supabase=isSupabaseConfigured?createClient(url!,anonKey!,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}}):null
export const oauthAvailability={google:isSupabaseConfigured&&import.meta.env.VITE_ENABLE_GOOGLE_OAUTH==='true',apple:isSupabaseConfigured&&import.meta.env.VITE_ENABLE_APPLE_OAUTH==='true'}
export const authConfiguration={configured:isSupabaseConfigured,google:oauthAvailability.google,apple:oauthAvailability.apple,isDevelopment:import.meta.env.DEV}
