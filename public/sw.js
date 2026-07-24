const CACHE='sphexpay-shell-v10'
const SHELL=['/','/index.html','/offline.html','/manifest.webmanifest','/branding/sphexpay-logo-96.png','/icons/sphexpay-app-192.png','/icons/sphexpay-app-512.png','/favicon/favicon-32.png']
const delivered=new Map()
const icon='/icons/sphexpay-app-192.png'
const badge='/branding/sphexpay-logo-96.png'

self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())))
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE&&key.startsWith('sphexpay-shell-')).map(key=>caches.delete(key)))).then(()=>self.clients.claim())))
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request).then(response=>{if(response.ok&&new URL(event.request.url).origin===self.location.origin){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)))}return response}).catch(()=>caches.match(event.request).then(cached=>cached||(event.request.mode==='navigate'?caches.match('/offline.html'):Response.error()))))})

const removeGatewayPrefix=value=>typeof value==='string'?value.replace(/^\s*(?:from\s+SphexPay\s*(?:\r?\n|[-–—:]\s*)?|enviado\s+por\s+SphexPay\s*(?:\r?\n)?)/i,'').trim():''
const normalizeRoute=route=>typeof route==='string'&&route.startsWith('/')?route:'/app/notificacoes'
const normalizePayload=value=>{
 if(!value||typeof value!=='object')return null
 const source=value
 const eventId=typeof source.eventId==='string'&&source.eventId.trim()?source.eventId.trim():typeof source.id==='string'&&source.id.trim()?source.id.trim():typeof source.tag==='string'&&source.tag.trim()?source.tag.trim():`push-${Date.now()}`
 const title=typeof source.title==='string'&&source.title.trim()?source.title.trim():'Nova notificação'
 const body=removeGatewayPrefix(typeof source.body==='string'?source.body:'')
 if(!body)return null
 return{eventId,title,body,route:normalizeRoute(source.route),type:typeof source.type==='string'?source.type:'system',tag:typeof source.tag==='string'&&source.tag.trim()?source.tag.trim():eventId}
}
const showDevice=async raw=>{
 const payload=normalizePayload(raw);if(!payload)return false
 const now=Date.now();for(const [id,time]of delivered)if(now-time>86400000)delivered.delete(id)
 if(delivered.has(payload.eventId))return false
 delivered.set(payload.eventId,now)
 await self.registration.showNotification(payload.title,{body:payload.body,icon,badge,tag:payload.tag,renotify:false,silent:false,data:{eventId:payload.eventId,route:payload.route,type:payload.type}})
 return true
}
const handlePush=async event=>{
 let payload=null
 try{if(event.data){try{payload=event.data.json()}catch{payload={body:event.data.text()}}}}catch{/* Push sem dados será ignorado com segurança. */}
 if(payload)await showDevice(payload)
}
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING'){self.skipWaiting();return}if(event.data?.type==='SHOW_DEVICE_NOTIFICATION')event.waitUntil(showDevice(event.data.payload))})
self.addEventListener('push',event=>{event.waitUntil(handlePush(event))})
self.addEventListener('notificationclick',event=>{event.notification.close();const data=event.notification.data||{},route=normalizeRoute(data.route);event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const target=clients.find(client=>new URL(client.url).origin===self.location.origin);if(target){await target.focus();if('navigate'in target)await target.navigate(route);return}await self.clients.openWindow(route)}))})
