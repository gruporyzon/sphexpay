// Autenticação de requisições serverless por bearer token do Supabase.
//
// Centraliza o padrão hoje repetido em cada handler: extrair o token do header
// Authorization e validá-lo com um client service_role (sem persistir sessão).
// Retorna { user } em caso de sucesso ou null caso contrário.

import { createClient } from '@supabase/supabase-js'
import { serviceRoleKey, supabaseUrl } from '../push/config.js'

const clean = value => (typeof value === 'string' ? value.trim() : '')

export const bearerToken = request =>
  clean(String(request?.headers?.authorization || '').replace(/^Bearer\s+/i, ''))

export const serverCredentialsConfigured = () => Boolean(supabaseUrl() && serviceRoleKey())

// Cria um client service_role. Reutilizável quando o handler também precisa
// fazer queries além de autenticar.
export const createServiceClient = () =>
  createClient(supabaseUrl(), serviceRoleKey(), { auth: { persistSession: false, autoRefreshToken: false } })

export async function authenticateRequest(request, client = createServiceClient()) {
  const token = bearerToken(request)
  if (!token) return { user: null, client, token: '' }
  try {
    const { data, error } = await client.auth.getUser(token)
    if (error || !data?.user) return { user: null, client, token }
    return { user: data.user, client, token }
  } catch {
    return { user: null, client, token }
  }
}
