import { createHmac, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { serviceRoleKey, supabaseUrl } from '../../server/push/config.js'
import { processPaymentEvent } from '../../server/payments/process-payment-event.js'
import { readRawBody } from '../../server/security/rawBody.js'
import { clientIp, ipAllowed, parseIpAllowlist } from '../../server/security/clientIp.js'
import { recordSecurityEvent } from '../../server/security/auditLog.js'

// O corpo bruto é obrigatório para verificar a assinatura HMAC byte a byte.
export const config = { api: { bodyParser: false } }

const TIMESTAMP_TOLERANCE_SECONDS = 300

const clean = value => (typeof value === 'string' ? value.trim() : '')
const hmacHex = (secret, payload) => createHmac('sha256', secret).update(payload).digest('hex')

const constantTimeEquals = (a, b) => {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  return left.length === right.length && timingSafeEqual(left, right)
}

// Aceita "sha256=<hex>" ou "<hex>" puro; compara contra o segredo atual e o anterior
// (janela de rotação de segredo).
const signatureMatches = (secrets, signedPayload, provided) => {
  const received = clean(provided).replace(/^sha256=/i, '')
  if (!received) return false
  return secrets.some(secret => secret && constantTimeEquals(hmacHex(secret, signedPayload), received))
}

const auditClient = () => {
  const url = supabaseUrl()
  const key = serviceRoleKey()
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

const reject = async (response, status, code, { request, provider = '', detail } = {}) => {
  await recordSecurityEvent(auditClient(), {
    eventType: 'webhook.rejected',
    ip: clientIp(request),
    userAgent: request?.headers?.['user-agent'],
    metadata: { code, provider: provider.slice(0, 60), detail: detail ? String(detail).slice(0, 120) : undefined }
  }).catch(() => {})
  return response.status(status).json({ success: false, code })
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED' })

  const secrets = [clean(process.env.PAYMENT_WEBHOOK_SECRET), clean(process.env.PAYMENT_WEBHOOK_SECRET_PREVIOUS)].filter(Boolean)
  const url = supabaseUrl()
  const key = serviceRoleKey()
  if (!secrets.length || !url || !key) {
    return response.status(503).json({ success: false, code: 'PAYMENT_WEBHOOK_NOT_CONFIGURED' })
  }

  const allowlist = parseIpAllowlist(process.env.PAYMENT_WEBHOOK_IP_ALLOWLIST)
  if (!ipAllowed(clientIp(request), allowlist)) {
    return reject(response, 403, 'IP_NOT_ALLOWED', { request })
  }

  let rawBody
  try {
    rawBody = await readRawBody(request)
  } catch (error) {
    if (error?.code === 'PAYLOAD_TOO_LARGE') return reject(response, 413, 'PAYLOAD_TOO_LARGE', { request })
    return reject(response, 400, 'INVALID_PAYMENT_EVENT', { request })
  }

  // Proteção de replay: o header de timestamp deve estar presente e recente,
  // e integra a carga assinada (padrão Stripe: "<timestamp>.<corpo>").
  const timestamp = clean(request.headers['x-sphexpay-timestamp'])
  if (!/^\d{1,15}$/.test(timestamp)) return reject(response, 400, 'MISSING_TIMESTAMP', { request })
  const skewSeconds = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (skewSeconds > TIMESTAMP_TOLERANCE_SECONDS) return reject(response, 401, 'STALE_WEBHOOK', { request })

  const signedPayload = `${timestamp}.${rawBody}`
  if (!signatureMatches(secrets, signedPayload, request.headers['x-sphexpay-signature'])) {
    return reject(response, 401, 'INVALID_WEBHOOK_SIGNATURE', { request })
  }

  let input
  try {
    input = JSON.parse(rawBody)
  } catch {
    return reject(response, 400, 'INVALID_PAYMENT_EVENT', { request })
  }

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const result = await processPaymentEvent({ client, input })
    await recordSecurityEvent(client, {
      eventType: 'webhook.accepted',
      ip: clientIp(request),
      userAgent: request?.headers?.['user-agent'],
      metadata: {
        provider: clean(input?.provider).slice(0, 60),
        eventType: clean(input?.eventType).slice(0, 60),
        duplicate: Boolean(result.duplicate),
        transactionId: result.publicTransactionId || null
      }
    }).catch(() => {})
    return response.status(200).json({ success: true, duplicate: Boolean(result.duplicate), transactionId: result.publicTransactionId })
  } catch (error) {
    const invalid = error?.code === 'INVALID_PAYMENT_EVENT' || error?.code === '22023'
    if (invalid) return reject(response, 400, 'INVALID_PAYMENT_EVENT', { request, provider: clean(input?.provider), detail: error?.message })
    return reject(response, 500, 'PAYMENT_PROCESSING_FAILED', { request, provider: clean(input?.provider) })
  }
}
