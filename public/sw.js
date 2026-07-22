/* SphexPay app shell. Web Push em segundo plano exigirá backend autorizado,
   VAPID, identidade do usuário e persistência de inscrições. */
const CACHE='sphexpay-shell-v3',SHELL=['/','/index.html','/offline.html','/manifest.webmanifest','/icons/app-192.svg','/icons/app-512.svg']
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())))
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())))
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request).then(response=>{if(response.ok&&new URL(event.request.url).origin===self.location.origin){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)))}return response}).catch(()=>caches.match(event.request).then(cached=>cached||((event.request.mode==='navigate')?caches.match('/offline.html'):Response.error()))))})
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()})
self.addEventListener('notificationclick',event=>{event.notification.close();const path=event.notification.data?.path||'/';event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{const current=clients[0];if(current){current.focus();return current.navigate(path)}return self.clients.openWindow(path)}))})
