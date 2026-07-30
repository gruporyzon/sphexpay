import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
const {getSessionMock}=vi.hoisted(()=>({getSessionMock:vi.fn()}))
vi.mock('../lib/supabase',()=>({supabase:{auth:{getSession:getSessionMock}}}))
vi.mock('../services/deviceIdentityService',()=>({getOrCreateDeviceIdentity:vi.fn(async()=>({deviceId:'22222222-2222-4222-8222-222222222222',automaticName:'Chrome no macOS',browser:'Chrome',operatingSystem:'macOS',platform:'desktop',displayMode:'browser',locale:'pt-BR',timezone:'America/Sao_Paulo'}))}))
import { getVapidPublicKey,pushSubscriptionService,requiresStandaloneForPush,urlBase64ToUint8Array } from '../services/pushSubscriptionService'

describe('pushSubscriptionService',()=>{
 beforeEach(()=>getSessionMock.mockResolvedValue({data:{session:{access_token:'access-token'}}}))
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
 it('não solicita novamente quando a permissão foi bloqueada',async()=>{
  class MockNotification{static permission='denied';static requestPermission=vi.fn()}
  vi.stubGlobal('Notification',MockNotification);vi.stubGlobal('PushManager',class {})
  Object.defineProperty(window,'isSecureContext',{configurable:true,value:true})
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{}})
  const result=await pushSubscriptionService.subscribe()
  expect(result).toMatchObject({ok:false,status:'permission-denied',code:'PERMISSION_DENIED'})
  expect(MockNotification.requestPermission).not.toHaveBeenCalled()
 })
 it('sincronização silenciosa não solicita permissão nem cria subscription',async()=>{
  class MockNotification{static permission='default';static requestPermission=vi.fn()}
  vi.stubGlobal('Notification',MockNotification);vi.stubGlobal('PushManager',class {})
  Object.defineProperty(window,'isSecureContext',{configurable:true,value:true})
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{}})
  const result=await pushSubscriptionService.syncExisting()
  expect(result).toMatchObject({ok:false,status:'permission-required',code:'PERMISSION_REQUIRED'})
  expect(MockNotification.requestPermission).not.toHaveBeenCalled()
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
  const registration={active:{},update:vi.fn(async()=>undefined),waiting:null,pushManager:{getSubscription:vi.fn(async()=>null),subscribe}}
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:vi.fn(async()=>registration),register:vi.fn(async()=>registration),ready:Promise.resolve(registration),controller:{}}})
  const fetchMock=vi.fn(async()=>new Response(JSON.stringify({registered:true,device:{id:'11111111-1111-4111-8111-111111111111',deviceId:'22222222-2222-4222-8222-222222222222',name:'Chrome no macOS',browser:'Chrome',operatingSystem:'macOS',enabled:true,lastSeenAt:'agora'}}),{status:200,headers:{'Content-Type':'application/json'}}))
  vi.stubGlobal('fetch',fetchMock)
  const result=await pushSubscriptionService.subscribe()
  expect(result.ok).toBe(true)
  expect(subscribe).toHaveBeenCalledWith({userVisibleOnly:true,applicationServerKey:bytes})
  expect(fetchMock).toHaveBeenCalledWith('/api/push/subscribe',expect.objectContaining({method:'POST',headers:expect.objectContaining({Authorization:'Bearer access-token'})}))
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
  const registration={active:{},update:vi.fn(async()=>undefined),waiting:null,pushManager:{getSubscription:vi.fn(async()=>oldSubscription),subscribe}}
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:vi.fn(async()=>registration),register:vi.fn(async()=>registration),ready:Promise.resolve(registration),controller:{}}})
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({registered:true,device:{id:'11111111-1111-4111-8111-111111111111',deviceId:'22222222-2222-4222-8222-222222222222',name:'Chrome no macOS',browser:'Chrome',operatingSystem:'macOS',enabled:true,lastSeenAt:'agora'}}),{status:200,headers:{'Content-Type':'application/json'}})))
  const result=await pushSubscriptionService.subscribe()
  expect(result.ok).toBe(true)
  expect(unsubscribe).toHaveBeenCalled()
  expect(subscribe).toHaveBeenCalledWith({userVisibleOnly:true,applicationServerKey:bytes})
 })
 it('reutiliza uma subscription existente compatível sem duplicar subscribe',async()=>{
  const bytes=Uint8Array.from({length:65},(_,index)=>index===0?4:index)
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY',btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''))
  class MockNotification{static permission='granted';static requestPermission=vi.fn()}
  vi.stubGlobal('Notification',MockNotification);vi.stubGlobal('PushManager',class {})
  Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});Object.defineProperty(navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 (Macintosh)'})
  const existing={endpoint:'https://push.example/current',expirationTime:null,options:{applicationServerKey:bytes.buffer},toJSON:()=>({keys:{p256dh:'p256dh-value-long-enough',auth:'auth-value-long'}})}
  const subscribe=vi.fn(),registration={active:{},update:vi.fn(async()=>undefined),waiting:null,pushManager:{getSubscription:vi.fn(async()=>existing),subscribe}}
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:vi.fn(async()=>registration),ready:Promise.resolve(registration),controller:{}}})
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({registered:true,device:{id:'11111111-1111-4111-8111-111111111111',deviceId:'22222222-2222-4222-8222-222222222222',name:'Chrome no macOS',browser:'Chrome',operatingSystem:'macOS',enabled:true,lastSeenAt:'agora'}}),{status:200})))
  expect((await pushSubscriptionService.subscribe()).ok).toBe(true)
  expect(subscribe).not.toHaveBeenCalled()
 })
 it('não cria subscription sem sessão autenticada',async()=>{
  const bytes=Uint8Array.from({length:65},(_,index)=>index===0?4:index)
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY',btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''))
  class MockNotification{static permission='granted';static requestPermission=vi.fn()}
  vi.stubGlobal('Notification',MockNotification);vi.stubGlobal('PushManager',class {})
  Object.defineProperty(window,'isSecureContext',{configurable:true,value:true})
  getSessionMock.mockResolvedValueOnce({data:{session:null}})
  const result=await pushSubscriptionService.subscribe()
  expect(result).toMatchObject({ok:false,code:'SESSION_MISSING'})
 })
 it('preserva InvalidAccessError como código técnico seguro',async()=>{
  const bytes=Uint8Array.from({length:65},(_,index)=>index===0?4:index)
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY',btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''))
  class MockNotification{static permission='granted';static requestPermission=vi.fn()}
  vi.stubGlobal('Notification',MockNotification);vi.stubGlobal('PushManager',class {})
  Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});Object.defineProperty(navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 (Macintosh)'})
  const registration={active:{},update:vi.fn(async()=>undefined),waiting:null,pushManager:{getSubscription:vi.fn(async()=>null),subscribe:vi.fn(async()=>{throw new DOMException('invalid key','InvalidAccessError')})}}
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:vi.fn(async()=>registration),ready:Promise.resolve(registration),controller:{}}})
  const result=await pushSubscriptionService.subscribe()
  expect(result).toMatchObject({ok:false,code:'PUSH_VAPID_INCOMPATIBLE'})
  expect(result.message).not.toContain('invalid key')
 })
 it('envia notificação manual somente ao backend com IDs seguros',async()=>{
  const fetchMock=vi.fn(async()=>new Response(JSON.stringify({success:true,eventId:'manual-event',sent:2,failed:0,expired:0}),{status:200,headers:{'Content-Type':'application/json'}}))
  vi.stubGlobal('fetch',fetchMock)
  const result=await pushSubscriptionService.sendManual({eventId:'manual-sequence-test-1',notificationType:'sale_approved',title:'Venda aprovada!',body:'Plano • R$ 10,00',route:'/app/transacoes',icon:'/icons/sphexpay-app-192.png',deviceIds:['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'],currency:'BRL'})
  expect(result).toMatchObject({ok:true,eventId:'manual-event',sent:2,failed:0,expired:0})
  const [,request]=fetchMock.mock.calls[0] as unknown as [string,RequestInit]
  const payload=JSON.parse(String(request?.body))
  expect(payload).toMatchObject({eventId:'manual-sequence-test-1',tag:'manual-sequence-test-1',type:'manual_notification',notificationType:'sale_approved',targetDeviceIds:['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'],metadata:{notificationType:'sale_approved',currency:'BRL'}})
  expect(payload).not.toHaveProperty('userId')
 })
 it('envia evento do modo com origem, rota e idempotência preservadas',async()=>{
  const fetchMock=vi.fn(async()=>new Response(JSON.stringify({success:true,eventId:'mode-sale:session:event-1',sent:1,failed:0,expired:0}),{status:200,headers:{'Content-Type':'application/json'}}))
  vi.stubGlobal('fetch',fetchMock)
  await pushSubscriptionService.sendMode({eventId:'mode-sale:session:event-1',notificationType:'pix_paid',title:'Venda aprovada · Pix',body:'Sua comissão: R$ 60,00',currency:'BRL',target:'all',deviceIds:[]})
  const [,request]=fetchMock.mock.calls[0] as unknown as [string,RequestInit],payload=JSON.parse(String(request.body))
  expect(payload).toMatchObject({eventId:'mode-sale:session:event-1',tag:'mode-sale:session:event-1',type:'mode_notification',route:'/app/vendas-ao-vivo',target:'all',metadata:{source:'mode',currency:'BRL'}})
  expect(payload).not.toHaveProperty('userId')
 })
 it.each(['desktop','mobile'] as const)('envia o destino %s do modo como categoria segura',async target=>{
  const fetchMock=vi.fn(async()=>new Response(JSON.stringify({success:true,eventId:'mode-sale:session:event-2',sent:1}),{status:200}))
  vi.stubGlobal('fetch',fetchMock)
  await pushSubscriptionService.sendMode({eventId:'mode-sale:session:event-2',notificationType:'pix_paid',title:'Venda aprovada · Pix',body:'Sua comissão: R$ 10,00',currency:'BRL',target,deviceIds:[]})
  const [,request]=fetchMock.mock.calls[0] as unknown as [string,RequestInit]
  const payload=JSON.parse(String(request.body))
  expect(payload).toMatchObject({targetCategory:target})
  expect(payload).not.toHaveProperty('targetDeviceIds')
 })
})
