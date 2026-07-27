import { afterEach,describe,expect,it,vi } from 'vitest'
import { getVapidPublicKey,pushSubscriptionService,requiresStandaloneForPush,urlBase64ToUint8Array } from '../services/pushSubscriptionService'

describe('pushSubscriptionService',()=>{
 afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks()})
 it('converte chaves VAPID base64 URL-safe em bytes',()=>{
  expect([...urlBase64ToUint8Array('AQID-_w')]).toEqual([1,2,3,251,252])
  expect([...urlBase64ToUint8Array(' AQID-_w=\n')]).toEqual([1,2,3,251,252])
 })
 it('recusa uma chave VAPID ausente',()=>{
  expect(()=>getVapidPublicKey()).toThrow('VAPID_PUBLIC_KEY_MISSING')
 })
 it('recusa uma chave VAPID que não representa uma chave pública P-256',()=>{
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY','A'.repeat(87))
  expect(()=>getVapidPublicKey()).toThrow('VAPID_PUBLIC_KEY_INVALID')
 })
 it('aceita uma chave pública P-256 URL-safe sem padding com 65 bytes e prefixo 0x04',()=>{
  const bytes=Uint8Array.from({length:65},(_,index)=>index===0?4:index)
  const key=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY',key)
  expect(getVapidPublicKey()).toEqual(bytes)
  expect(key).not.toContain('=')
 })
 it('não exige PWA instalada no desktop ou Android',()=>{
  expect(requiresStandaloneForPush('Mozilla/5.0 (Macintosh)',false)).toBe(false)
  expect(requiresStandaloneForPush('Mozilla/5.0 (Windows NT 10.0)',false)).toBe(false)
  expect(requiresStandaloneForPush('Mozilla/5.0 (Linux; Android 15)',false)).toBe(false)
 })
 it('exige modo standalone somente no iPhone e iPad',()=>{
  expect(requiresStandaloneForPush('Mozilla/5.0 (iPhone)',false)).toBe(true)
  expect(requiresStandaloneForPush('Mozilla/5.0 (iPad)',false)).toBe(true)
  expect(requiresStandaloneForPush('Mozilla/5.0 (iPhone)',true)).toBe(false)
 })
 it('cria a subscription inexistente e só confirma após registrá-la no backend',async()=>{
  const bytes=Uint8Array.from({length:65},(_,index)=>index===0?4:index)
  const key=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY',key)
  class MockNotification{static permission='default';static requestPermission=vi.fn(async()=>{MockNotification.permission='granted';return'granted' as NotificationPermission})}
  vi.stubGlobal('Notification',MockNotification)
  vi.stubGlobal('PushManager',class {})
  Object.defineProperty(window,'isSecureContext',{configurable:true,value:true})
  Object.defineProperty(navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 (Macintosh)'})
  const subscription={endpoint:'https://push.example/subscription',options:{applicationServerKey:null},toJSON:()=>({keys:{p256dh:'p256dh-value-long-enough',auth:'auth-value'}})}
  const subscribe=vi.fn(async()=>subscription)
  const registration={update:vi.fn(async()=>undefined),waiting:null,pushManager:{getSubscription:vi.fn(async()=>null),subscribe}}
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:vi.fn(async()=>registration),register:vi.fn(async()=>registration),ready:Promise.resolve(registration),controller:{}}})
  const fetchMock=vi.fn(async()=>new Response(JSON.stringify({success:true,registered:true,deviceId:'device-1'}),{status:200,headers:{'Content-Type':'application/json'}}))
  vi.stubGlobal('fetch',fetchMock)
  const result=await pushSubscriptionService.subscribe('user-1')
  expect(result.ok).toBe(true)
  expect(subscribe).toHaveBeenCalledWith({userVisibleOnly:true,applicationServerKey:bytes})
  expect(fetchMock).toHaveBeenCalledWith('/api/push/subscribe',expect.objectContaining({method:'POST'}))
 })
 it('substitui uma subscription criada com outro par VAPID',async()=>{
  const bytes=Uint8Array.from({length:65},(_,index)=>index===0?4:index)
  const key=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY',key)
  class MockNotification{static permission='granted';static requestPermission=vi.fn()}
  vi.stubGlobal('Notification',MockNotification)
  vi.stubGlobal('PushManager',class {})
  Object.defineProperty(window,'isSecureContext',{configurable:true,value:true})
  Object.defineProperty(navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 (Macintosh)'})
  const unsubscribe=vi.fn(async()=>true)
  const oldSubscription={endpoint:'https://push.example/old',options:{applicationServerKey:Uint8Array.from({length:65},()=>9).buffer},unsubscribe}
  const newSubscription={endpoint:'https://push.example/new',options:{applicationServerKey:bytes.buffer},toJSON:()=>({keys:{p256dh:'p256dh-value-long-enough',auth:'auth-value'}})}
  const subscribe=vi.fn(async()=>newSubscription)
  const registration={update:vi.fn(async()=>undefined),waiting:null,pushManager:{getSubscription:vi.fn(async()=>oldSubscription),subscribe}}
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:vi.fn(async()=>registration),register:vi.fn(async()=>registration),ready:Promise.resolve(registration),controller:{}}})
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({success:true,registered:true,deviceId:'device-new'}),{status:200,headers:{'Content-Type':'application/json'}})))
  const result=await pushSubscriptionService.subscribe('user-1')
  expect(result.ok).toBe(true)
  expect(unsubscribe).toHaveBeenCalled()
  expect(subscribe).toHaveBeenCalledWith({userVisibleOnly:true,applicationServerKey:bytes})
 })
})
