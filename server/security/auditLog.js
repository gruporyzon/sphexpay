// Registro de eventos de segurança server-side em public.security_audit_log.
//
// Usa um client service_role (a tabela só aceita escrita por service_role).
// Nunca registra corpo de webhook, PII do comprador ou dados de cartão —
// apenas metadados operacionais. Falhas de auditoria não devem abortar o fluxo
// de negócio; o chamador decide o que fazer com o retorno.

import { createHash } from 'node:crypto'

const clean = value => (typeof value === 'string' ? value.trim() : '')

// Hash do IP com sal fixo do ambiente — a tabela nunca guarda IP em claro.
export function hashIp(ip) {
  const value = clean(ip)
  if (!value) return null
  const salt = clean(process.env.SECURITY_AUDIT_IP_SALT) || 'sphexpay-audit'
  return createHash('sha256').update(`${salt}:${value}`).digest('hex')
}

export async function recordSecurityEvent(client, { eventType, actorId = null, ip = null, userAgent = null, metadata = {} }) {
  if (!client || !eventType) return { ok: false }
  try {
    const { error } = await client.from('security_audit_log').insert({
      event_type: String(eventType).slice(0, 80),
      actor_id: actorId,
      ip_hash: hashIp(ip),
      user_agent: clean(userAgent).slice(0, 400) || null,
      metadata: metadata && typeof metadata === 'object' ? metadata : {}
    })
    return { ok: !error }
  } catch {
    return { ok: false }
  }
}
