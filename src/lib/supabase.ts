import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isValidSupabaseUrl = (value: unknown): value is string => {
  if (!isNonEmptyString(value)) return false;

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.hostname === "localhost";
  } catch {
    return false;
  }
};

const hasValidUrl = isValidSupabaseUrl(supabaseUrl);
const hasValidPublishableKey = isNonEmptyString(supabasePublishableKey);

if (import.meta.env.DEV) {
  console.info(
    `[Supabase] URL configurada: ${hasValidUrl ? "sim" : "não"}; ` +
      `chave publicável configurada: ${hasValidPublishableKey ? "sim" : "não"}.`
  );
}

let initializedClient: SupabaseClient | null = null;

if (
  isValidSupabaseUrl(supabaseUrl) &&
  isNonEmptyString(supabasePublishableKey)
) {
  try {
    initializedClient = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch {
    initializedClient = null;
  }
}

export const supabase = initializedClient;
export const isSupabaseClientAvailable = supabase !== null;
export const isSupabaseConfigured = isSupabaseClientAvailable;
export const supabaseUnavailableMessage =
  "A autenticação ainda não foi configurada para este ambiente.";
export const oauthAvailability = {
  google:
    isSupabaseClientAvailable &&
    import.meta.env.VITE_ENABLE_GOOGLE_OAUTH === "true",
  apple:
    isSupabaseClientAvailable &&
    import.meta.env.VITE_ENABLE_APPLE_OAUTH === "true",
};
export const authConfiguration = {
  configured: isSupabaseClientAvailable,
  google: oauthAvailability.google,
  apple: oauthAvailability.apple,
  isDevelopment: import.meta.env.DEV,
};
