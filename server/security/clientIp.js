// Extração de IP do cliente atrás do proxy da Vercel.
// A Vercel injeta x-forwarded-for com o IP real do cliente como primeiro item.
// Nunca confie em headers arbitrários enviados pelo cliente para além disso.

const clean = value => (typeof value === 'string' ? value.trim() : '')

export function clientIp(request) {
  const forwarded = clean(request?.headers?.['x-forwarded-for'])
  if (forwarded) return forwarded.split(',')[0].trim()
  return clean(request?.headers?.['x-real-ip']) || clean(request?.socket?.remoteAddress) || ''
}

// Faz o parse de uma allowlist CSV (IPs exatos). Retorna null quando não configurada,
// sinalizando que nenhuma restrição de origem deve ser aplicada.
export function parseIpAllowlist(raw) {
  const value = clean(raw)
  if (!value) return null
  const entries = value.split(',').map(item => item.trim()).filter(Boolean)
  return entries.length ? new Set(entries) : null
}

export function ipAllowed(ip, allowlist) {
  if (!allowlist) return true
  return allowlist.has(clean(ip))
}
