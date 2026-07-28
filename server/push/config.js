import webpush from 'web-push'
import { createECDH } from 'node:crypto'

const clean = value => typeof value === 'string' ? value.trim() : ''
const compactBase64Url = value => clean(value).replace(/\s+/g, '').replace(/=+$/g, '')
const base64Url = /^[A-Za-z0-9_-]+$/
const exampleValue = value => /example|your[_-]?|changeme/i.test(value)
const validHttpUrl=value=>{
 try{
  const parsed=new URL(value)
  return (parsed.protocol==='https:'||parsed.protocol==='http:')&&Boolean(parsed.hostname)
 }catch{return false}
}

export const supabaseUrl = () => [process.env.SUPABASE_URL,process.env.VITE_SUPABASE_URL].map(clean).find(validHttpUrl)||''
export const serviceRoleKey = () => clean(process.env.SUPABASE_SERVICE_ROLE_KEY)

export function vapidConfiguration() {
 const rawPublicKey = typeof process.env.VAPID_PUBLIC_KEY === 'string' ? process.env.VAPID_PUBLIC_KEY : ''
 const rawPrivateKey = typeof process.env.VAPID_PRIVATE_KEY === 'string' ? process.env.VAPID_PRIVATE_KEY : ''
 const rawSubject = typeof process.env.VAPID_SUBJECT === 'string' ? process.env.VAPID_SUBJECT : ''
 const publicKey = compactBase64Url(rawPublicKey)
 const privateKey = compactBase64Url(rawPrivateKey)
 const subject = clean(rawSubject)
 const checks = {
  serverPublicKeyPresent: Boolean(publicKey),
  publicKeyBase64Url: false,
  publicKeyLength: false,
  publicKeyUncompressed: false,
  privateKeyPresent: Boolean(privateKey),
  privateKeyValid: false,
  keyPairValid: false,
  subjectValid: false
 }
 let configured = false
 try {
  const publicBytes = Buffer.from(publicKey, 'base64url')
  const privateBytes = Buffer.from(privateKey, 'base64url')
  checks.publicKeyBase64Url = base64Url.test(publicKey) && !exampleValue(publicKey)
  checks.publicKeyLength = publicBytes.length === 65
  checks.publicKeyUncompressed = publicBytes[0] === 4
  checks.privateKeyValid = base64Url.test(privateKey) && !exampleValue(privateKey) && privateBytes.length === 32
  if(checks.privateKeyValid){
   const ecdh=createECDH('prime256v1')
   ecdh.setPrivateKey(privateBytes)
   checks.keyPairValid=ecdh.getPublicKey().equals(publicBytes)
  }
  try {
   const parsedSubject = new URL(subject)
   checks.subjectValid = parsedSubject.protocol === 'mailto:' || parsedSubject.protocol === 'https:'
  } catch {
   checks.subjectValid = false
  }
  configured = Object.values(checks).every(Boolean)
  if (configured) webpush.setVapidDetails(subject, publicKey, privateKey)
 } catch {
  configured = false
 }
 return { configured, publicKey, privateKey, subject, checks }
}

export function pushConfiguration() {
 const vapid = vapidConfiguration()
 const rawServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
 const storageConfigured = Boolean(supabaseUrl() && serviceRoleKey())
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
