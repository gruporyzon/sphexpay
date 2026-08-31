const CACHE='sphexpay-static-v15'
const STATIC=['/offline.html','/manifest.webmanifest','/icons/sphexpay-home-192-v2.png','/brand/sphex-symbol-white.png']

self.addEventListener('install',event=>{
 self.skipWaiting()
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)))
})

self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys()
  await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))
  await self.clients.claim()
 })())
})

self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match('/offline.html')))
  return
 }
 const url=new URL(event.request.url)
 if(url.origin!==self.location.origin)return
 event.respondWith(fetch(event.request).catch(()=>caches.match(event.request).then(cached=>cached||Response.error())))
})

const safeRoute=value=>{
 if(typeof value!=='string'||!/^\/(?!\/)[A-Za-z0-9_?=&%./-]*$/.test(value))return'/app'
 try{
  const url=new URL(value,self.location.origin)
  return url.origin===self.location.origin?`${url.pathname}${url.search}${url.hash}`:'/app'
 }catch{return'/app'}
}
const cleanBody=value=>typeof value==='string'
 ? value.replace(/^\s*from\s+SphexPay\s*/i,'').replace(/^\s*via\s+SphexPay\s*/i,'').trim()
 : ''

async function handlePush(event){
 let payload={}
 try{
  payload=event.data?event.data.json():{}
 }catch{
  payload={title:'SphexPay',body:event.data?.text()||'Você recebeu uma atualização.'}
 }
 const title=typeof payload.title==='string'?payload.title:'SphexPay'
 const body=cleanBody(payload.body)
 const tag=typeof payload.tag==='string'&&payload.tag?payload.tag:payload.eventId
 if(tag){
  const visible=await self.registration.getNotifications({tag})
  if(visible.length)return
 }
 await self.registration.showNotification(title,{
  body,
  icon:typeof payload.icon==='string'&&payload.icon.startsWith('/icons/')?payload.icon:'/icons/sphexpay-app-192.png',
  badge:typeof payload.badge==='string'&&payload.badge.startsWith('/brand/')?payload.badge:'/brand/sphex-symbol-white.png',
  tag,
  renotify:false,
  silent:false,
  timestamp:Number.isFinite(payload.timestamp)?payload.timestamp:Date.now(),
  requireInteraction:payload.requireInteraction===true,
  data:{route:safeRoute(payload.route),eventId:payload.eventId,type:payload.type}
 })
}

self.addEventListener('push',event=>{
 event.waitUntil(handlePush(event))
})

self.addEventListener('notificationclick',event=>{
 event.notification.close()
 const route=safeRoute(event.notification.data?.route)
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true})
  const current=windows.find(client=>{
   try{return new URL(client.url).origin===self.location.origin}catch{return false}
  })
  if(current){
   if('navigate'in current){
    const currentRoute=new URL(current.url)
    if(`${currentRoute.pathname}${currentRoute.search}${currentRoute.hash}`!==route)await current.navigate(route)
   }
   await current.focus()
   return
  }
  await self.clients.openWindow(route)
 })())
})

self.addEventListener('pushsubscriptionchange',event=>{
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true})
  for(const client of windows)client.postMessage({type:'PUSH_SUBSCRIPTION_CHANGED'})
 })())
})
