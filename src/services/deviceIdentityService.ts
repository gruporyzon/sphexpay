export interface DeviceIdentity{
 deviceId:string
 automaticName:string
 browser:string
 operatingSystem:string
 platform:string
 displayMode:'browser'|'standalone'
 locale:string
 timezone:string
}

const databaseName='sphexpay-device'
const storeName='identity'
const identityKey='current'
const fallbackKey='sphexpay_device_id_v1'
let identityPromise:Promise<DeviceIdentity>|null=null

const browserName=(userAgent:string)=>/Edg\//i.test(userAgent)?'Edge':/CriOS|Chrome\//i.test(userAgent)?'Chrome':/FxiOS|Firefox\//i.test(userAgent)?'Firefox':/Safari\//i.test(userAgent)?'Safari':'Navegador'
const operatingSystemName=(userAgent:string)=>/iPhone|iPad|iPod/i.test(userAgent)?'iPhone':/Android/i.test(userAgent)?'Android':/Mac OS X|Macintosh/i.test(userAgent)?'macOS':/Windows/i.test(userAgent)?'Windows':/Linux/i.test(userAgent)?'Linux':'Outro'
const standaloneMode=()=>matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone)

export function describeDevice(userAgent=navigator.userAgent,standalone=standaloneMode()){
 const browser=browserName(userAgent),operatingSystem=operatingSystemName(userAgent),displayMode=standalone?'standalone' as const:'browser' as const
 const automaticName=standalone?`Aplicativo SphexPay no ${operatingSystem}`:`${browser} no ${operatingSystem}`
 return{automaticName,browser,operatingSystem,platform:/Mobile|iPhone|iPad|Android/i.test(userAgent)?'mobile':'desktop',displayMode}
}

const readIndexedDb=()=>new Promise<string|null>((resolve,reject)=>{
 if(!('indexedDB'in window)){resolve(null);return}
 const request=indexedDB.open(databaseName,1)
 request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(storeName))request.result.createObjectStore(storeName)}
 request.onerror=()=>reject(request.error)
 request.onsuccess=()=>{const transaction=request.result.transaction(storeName,'readonly'),get=transaction.objectStore(storeName).get(identityKey);get.onsuccess=()=>resolve(typeof get.result==='string'?get.result:null);get.onerror=()=>reject(get.error)}
})

const writeIndexedDb=(deviceId:string)=>new Promise<void>((resolve,reject)=>{
 if(!('indexedDB'in window)){resolve();return}
 const request=indexedDB.open(databaseName,1)
 request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(storeName))request.result.createObjectStore(storeName)}
 request.onerror=()=>reject(request.error)
 request.onsuccess=()=>{const transaction=request.result.transaction(storeName,'readwrite');transaction.objectStore(storeName).put(deviceId,identityKey);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error)}
})

const persistentDeviceId=async()=>{
 let deviceId:string|null=null
 try{deviceId=await readIndexedDb()}catch{/* localStorage mantém a identidade quando IndexedDB falha. */}
 if(!deviceId)try{deviceId=localStorage.getItem(fallbackKey)}catch{/* armazenamento pode estar bloqueado. */}
 if(!deviceId){deviceId=crypto.randomUUID();try{await writeIndexedDb(deviceId)}catch{/* fallback abaixo. */}try{localStorage.setItem(fallbackKey,deviceId)}catch{/* o id permanece estável durante a sessão. */}}
 return deviceId
}

export async function getOrCreateDeviceIdentity():Promise<DeviceIdentity>{
 if(identityPromise)return identityPromise
 identityPromise=(async()=>{
  const deviceId=await persistentDeviceId(),description=describeDevice()
  return{deviceId,...description,locale:navigator.language||'pt-BR',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}
 })().catch(error=>{identityPromise=null;throw error})
 return identityPromise
}
