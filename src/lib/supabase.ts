import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const isValidString=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0
const isValidSupabaseUrl=(value:unknown):value is string=>{
 if(!isValidString(value))return false
 try{const parsed=new URL(value);return parsed.protocol==='https:'||import.meta.env.DEV&&parsed.protocol==='http:'}catch{return false}
}

export const supabaseEnvironment={
 urlConfigured:isValidSupabaseUrl(supabaseUrl),
 publishableKeyConfigured:isValidString(supabasePublishableKey)
}

const initializeSupabase=()=>{
 if(!isValidSupabaseUrl(supabaseUrl)||!isValidString(supabasePublishableKey))return null
 return createClient(supabaseUrl,supabasePublishableKey,{
  auth:{
   persistSession:true,
   autoRefreshToken:true,
   detectSessionInUrl:true
  }
 })
}

export const supabase=initializeSupabase()
export const isSupabaseConfigured=supabase!==null
export const oauthAvailability={google:isSupabaseConfigured&&import.meta.env.VITE_ENABLE_GOOGLE_OAUTH==='true',apple:isSupabaseConfigured&&import.meta.env.VITE_ENABLE_APPLE_OAUTH==='true'}
export const authConfiguration={configured:isSupabaseConfigured,google:oauthAvailability.google,apple:oauthAvailability.apple,isDevelopment:import.meta.env.DEV}
