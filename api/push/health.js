import { pushConfiguration } from './config.js'

export default function handler(request,response){
 if(request.method!=='GET')return response.status(405).json({success:false,code:'METHOD_NOT_ALLOWED',message:'Método não permitido.'})
 const {vapidConfigured,storageConfigured,sendConfigured,storageCode}=pushConfiguration()
 return response.status(200).json({success:true,vapidConfigured,storageConfigured,sendConfigured,...(storageCode?{storageCode}:{})})
}
