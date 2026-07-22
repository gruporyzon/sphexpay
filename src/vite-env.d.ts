/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_ENABLE_GOOGLE_OAUTH?: string
  readonly VITE_ENABLE_APPLE_OAUTH?: string
}

interface ImportMeta { readonly env: ImportMetaEnv }
