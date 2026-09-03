import {authenticate,fail,findConnection,retrieveAndSync,safeStatus,serverDatabase} from '../../../server/stripe/connect.js'

export default async function handler(request,response){
 if(request.method!=='GET')return response.status(405).json({success:false,code:'METHOD_NOT_ALLOWED',message:'Método não permitido.'})
 try{const database=serverDatabase(),user=await authenticate(request,database),connection=await findConnection(database,user.id);if(!connection)return response.status(200).json({success:true,...safeStatus(null)});const current=await retrieveAndSync(database,user.id,connection);return response.status(200).json({success:true,...safeStatus(current)})}catch(error){return fail(response,error)}
}
