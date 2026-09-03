import {authenticate,createOnboardingLink,ensureConnectedAccount,fail,serverDatabase} from '../../../server/stripe/connect.js'

export default async function handler(request,response){
 if(request.method!=='POST')return response.status(405).json({success:false,code:'METHOD_NOT_ALLOWED',message:'Método não permitido.'})
 try{const database=serverDatabase(),user=await authenticate(request,database),connection=await ensureConnectedAccount(database,user),link=await createOnboardingLink(connection);return response.status(200).json({success:true,url:link.url})}catch(error){return fail(response,error)}
}
