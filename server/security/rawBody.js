// Leitura do corpo bruto (bytes exatos) de uma requisição serverless.
//
// A verificação de assinatura HMAC de webhooks precisa operar sobre os bytes
// exatamente como o provedor os enviou. Reserializar `request.body` com
// JSON.stringify NAO reproduz os mesmos bytes (ordem de chaves, espaços,
// escaping) e invalida a checagem. Handlers que verificam assinatura devem
// desligar o bodyParser (`export const config = { api: { bodyParser: false } }`)
// e usar esta função.

const MAX_BYTES = 1_000_000 // 1 MB — webhooks financeiros são pequenos.

export async function readRawBody(request) {
  // Alguns runtimes/ferramentas de teste já entregam o corpo pronto.
  if (typeof request.body === 'string') return request.body
  if (Buffer.isBuffer(request.body)) return request.body.toString('utf8')
  if (request.rawBody) {
    return Buffer.isBuffer(request.rawBody) ? request.rawBody.toString('utf8') : String(request.rawBody)
  }
  if (typeof request[Symbol.asyncIterator] !== 'function' && typeof request.on !== 'function') {
    // Sem stream disponível: último recurso, pode não ser byte-idêntico.
    return request.body != null ? JSON.stringify(request.body) : ''
  }
  const chunks = []
  let total = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.length
    if (total > MAX_BYTES) throw Object.assign(new Error('PAYLOAD_TOO_LARGE'), { code: 'PAYLOAD_TOO_LARGE' })
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}
