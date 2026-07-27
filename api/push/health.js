import { pushConfiguration } from './config.js'

export default function handler(request,response){
 if(request.method!=='GET')return response.status(405).json({success:false,code:'METHOD_NOT_ALLOWED',message:'Método não permitido.'})
 const {vapid,vapidConfigured,storageConfigured,sendConfigured,vapidCode,storageCode,sendCode}=pushConfiguration()
 return response.status(200).json({
  success:true,
  vapidConfigured,
  storageConfigured,
  sendConfigured,
  checks:{
   viteVapidPublicKeyPresent:vapid.checks.clientPublicKeyPresent,
   vapidPublicKeyPresent:vapid.checks.serverPublicKeyPresent,
   publicKeysMatch:vapid.checks.publicKeysMatch,
   publicKeyBase64Url:vapid.checks.publicKeyBase64Url,
   publicKeyLength65:vapid.checks.publicKeyLength,
   publicKeyFirstByte04:vapid.checks.publicKeyUncompressed,
   privateKeyPresent:vapid.checks.privateKeyPresent,
   privateKeyValid:vapid.checks.privateKeyValid,
   subjectValid:vapid.checks.subjectValid,
   supabaseServerConfigured:storageConfigured
  },
  codes:[vapidCode,storageCode,sendCode].filter(Boolean)
 })
}
