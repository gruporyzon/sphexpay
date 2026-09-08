// Rate limiter de janela deslizante em memória.
//
// ATENCAO: o estado vive no processo da função serverless. Cada instância/região
// da Vercel mantém a própria contagem, então o limite efetivo é aproximado sob
// escala horizontal. Para produção com garantia forte, migrar para um store
// compartilhado (Upstash Redis / Vercel KV) preservando esta mesma interface.

const buckets = new Map()

// Consome uma unidade da janela de `key`. Retorna { allowed, remaining, retryAfterSeconds }.
export function consumeRateLimit(key, { limit, windowMs }) {
  const now = Date.now()
  const windowStart = now - windowMs
  const hits = (buckets.get(key) || []).filter(timestamp => timestamp > windowStart)
  if (hits.length >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000))
    buckets.set(key, hits)
    return { allowed: false, remaining: 0, retryAfterSeconds }
  }
  hits.push(now)
  buckets.set(key, hits)
  return { allowed: true, remaining: limit - hits.length, retryAfterSeconds: 0 }
}

// Apenas para testes: zera todo o estado.
export function resetRateLimitState() {
  buckets.clear()
}
