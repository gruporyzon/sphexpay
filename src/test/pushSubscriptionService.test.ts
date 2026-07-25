import { afterEach,describe,expect,it,vi } from 'vitest'
import { getVapidPublicKey,urlBase64ToUint8Array } from '../services/pushSubscriptionService'

describe('pushSubscriptionService',()=>{
 afterEach(()=>vi.unstubAllEnvs())
 it('converte chaves VAPID base64 URL-safe em bytes',()=>{
  expect([...urlBase64ToUint8Array('AQID-_w')]).toEqual([1,2,3,251,252])
 })
 it('recusa uma chave VAPID ausente',()=>{
  expect(()=>getVapidPublicKey()).toThrow('VAPID_PUBLIC_KEY_MISSING')
 })
 it('recusa uma chave VAPID que não representa uma chave pública P-256',()=>{
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY','A'.repeat(87))
  expect(()=>getVapidPublicKey()).toThrow('VAPID_PUBLIC_KEY_INVALID')
 })
 it('aceita uma chave pública P-256 no formato URL-safe',()=>{
  const bytes=Uint8Array.from({length:65},(_,index)=>index===0?4:index)
  const key=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY',key)
  expect(getVapidPublicKey()).toBe(key)
 })
})
