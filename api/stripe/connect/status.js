import {configureProductPayments} from '../../../server/stripe/payments.js'
import {ConnectError,authenticate,fail,findConnection,parseJsonBody,retrieveAndSync,safeStatus,serverDatabase} from '../../../server/stripe/connect.js'

export default async function handler(request,response){
 response.setHeader('Cache-Control','no-store')
 if(!['GET','POST'].includes(request.method))return response.status(405).json({success:false,code:'METHOD_NOT_ALLOWED',message:'Método não permitido.'})
 try{const database=serverDatabase(),user=await authenticate(request,database);if(request.method==='POST'){const input=parseJsonBody(request);return response.status(200).json({success:true,...await configureProductPayments(database,user,input)})}const connection=await findConnection(database,user.id,true);if(!connection)return response.status(200).json({success:true,...safeStatus(null)});const current=await retrieveAndSync(database,user.id,connection);return response.status(200).json({success:true,...safeStatus(current)})}catch(error){
  if(request.method==='GET'){
   if(['CONNECT_STORAGE_ERROR','SERVER_NOT_CONFIGURED','STRIPE_NOT_CONFIGURED'].includes(error?.code))return fail(response,new ConnectError(error.code,500,'Não foi possível atualizar a configuração de pagamentos.'))
   if(error?.code==='AUTH_UNAVAILABLE')return fail(response,new ConnectError(error.code,502,error.message))
   if(!(error instanceof ConnectError))return fail(response,new ConnectError('CONNECT_INTERNAL_ERROR',500,'Não foi possível atualizar o status da sua conta de pagamentos.'))
  }
  return fail(response,error)
 }
}
