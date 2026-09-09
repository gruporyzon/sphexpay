import {configureProductPayments} from '../../../server/stripe/payments.js'
import {authenticate,fail,findConnection,parseJsonBody,retrieveAndSync,safeStatus,serverDatabase} from '../../../server/stripe/connect.js'

export default async function handler(request,response){
 response.setHeader('Cache-Control','no-store')
 if(!['GET','POST'].includes(request.method))return response.status(405).json({success:false,code:'METHOD_NOT_ALLOWED',message:'Método não permitido.'})
 try{const database=serverDatabase(),user=await authenticate(request,database);if(request.method==='POST'){const input=parseJsonBody(request);return response.status(200).json({success:true,...await configureProductPayments(database,user,input)})}const connection=await findConnection(database,user.id);if(!connection)return response.status(200).json({success:true,...safeStatus(null)});const current=await retrieveAndSync(database,user.id,connection);return response.status(200).json({success:true,...safeStatus(current)})}catch(error){return fail(response,error)}
}
