import webpush from 'web-push'

const clean = value => typeof value === 'string' ? value.trim() : ''
const base64Url = /^[A-Za-z0-9_-]+$/
const exampleValue = value => /example|your[_-]?|changeme/i.test(value)

export const supabaseUrl = () => clean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)
export const serviceRoleKey = () => clean(process.env.SUPABASE_SERVICE_ROLE_KEY)

export function vapidConfiguration() {
 const rawPublicKey = typeof process.env.VAPID_PUBLIC_KEY === 'string' ? process.env.VAPID_PUBLIC_KEY : ''
 const rawPrivateKey = typeof process.env.VAPID_PRIVATE_KEY === 'string' ? process.env.VAPID_PRIVATE_KEY : ''
 const rawSubject = typeof process.env.VAPID_SUBJECT === 'string' ? process.env.VAPID_SUBJECT : ''
 const publicKey = clean(rawPublicKey)
 const privateKey = clean(rawPrivateKey)
 const subject = clean(rawSubject)
 let configured = Boolean(publicKey && privateKey && subject)
  && rawPublicKey === publicKey
  && rawPrivateKey === privateKey
  && rawSubject === subject
 try {
  const publicBytes = Buffer.from(publicKey, 'base64url')
  const privateBytes = Buffer.from(privateKey, 'base64url')
  configured = configured
   && base64Url.test(publicKey)
   && base64Url.test(privateKey)
   && !exampleValue(publicKey)
   && !exampleValue(privateKey)
   && publicBytes.length === 65
   && publicBytes[0] === 4
   && privateBytes.length === 32
  if (configured) webpush.setVapidDetails(subject, publicKey, privateKey)
 } catch {
  configured = false
 }
 return { configured, publicKey, privateKey, subject }
}

export function pushConfiguration() {
 const vapid = vapidConfiguration()
 const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
 const rawServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
 const storageConfigured = Boolean(supabaseUrl() && serviceRoleKey())
  && rawUrl === supabaseUrl()
  && rawServiceRole === serviceRoleKey()
 return {
  vapid,
  vapidConfigured: vapid.configured,
  storageConfigured,
  sendConfigured: vapid.configured && storageConfigured,
  vapidCode: vapid.configured ? undefined : 'VAPID_NOT_CONFIGURED',
  storageCode: storageConfigured ? undefined : 'SUPABASE_SERVER_CREDENTIALS_MISSING',
  sendCode: vapid.configured && storageConfigured ? undefined : 'PUSH_SEND_NOT_CONFIGURED'
 }
}
