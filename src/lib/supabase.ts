import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

if (import.meta.env.DEV) {
  console.info("Supabase config:", {
    urlConfigured: Boolean(import.meta.env.VITE_SUPABASE_URL),
    publishableKeyConfigured: Boolean(
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    ),
  });
}

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabasePublishableKey &&
  supabaseUrl.startsWith("https://") &&
  supabasePublishableKey.startsWith("sb_publishable_")
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabasePublishableKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const isSupabaseClientAvailable = Boolean(supabase);
export const supabaseUnavailableMessage =
  "A autenticação ainda não foi configurada para este ambiente.";
export const oauthAvailability={google:isSupabaseClientAvailable&&import.meta.env.VITE_ENABLE_GOOGLE_OAUTH==='true',apple:isSupabaseClientAvailable&&import.meta.env.VITE_ENABLE_APPLE_OAUTH==='true'}
export const authConfiguration={configured:isSupabaseClientAvailable,google:oauthAvailability.google,apple:oauthAvailability.apple,isDevelopment:import.meta.env.DEV}
