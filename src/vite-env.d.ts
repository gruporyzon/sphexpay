/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_DASHBOARD_DATA_MODE?: 'production'|'demo'
  readonly VITE_ENABLE_GOOGLE_OAUTH?: string
  readonly VITE_ENABLE_APPLE_OAUTH?: string
}

interface ImportMeta { readonly env: ImportMetaEnv }
