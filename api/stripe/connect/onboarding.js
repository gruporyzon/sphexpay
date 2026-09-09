import {authenticate,ConnectError,configuredAppUrl,createOnboardingLink,fail,findConnection,ensureConnectedAccount,serverDatabase} from '../../../server/stripe/connect.js'
import {logOnboardingContext,logOnboardingError,onboardingFailureStatus} from '../../../server/stripe/onboardingDiagnostics.js'
import {getStripe} from '../../../server/stripe/client.js'
import {randomUUID} from 'node:crypto'

export default async function handler(request,response){
 if(request.method!=='POST')return response.status(405).json({success:false,code:'METHOD_NOT_ALLOWED',message:'Método não permitido.'})
 let stage='database_configuration'
 const context={diagnostic_id:randomUUID(),connection_exists:null}
 try{
  const database=serverDatabase()
  stage='authenticate'
  const user=await authenticate(request,database)
  stage='find_connection'
  let connection=await findConnection(database,user.id)
  context.connection_exists=Boolean(connection)
  stage='validate_connection'
  if(connection&&connection.user_id!==user.id)throw new ConnectError('CONNECT_OWNERSHIP_MISMATCH',403,'Conta de pagamentos incompatível com o usuário.')
  if(connection&&(typeof connection.stripe_account_id!=='string'||!/^acct_[A-Za-z0-9]+$/.test(connection.stripe_account_id)))throw new ConnectError('CONNECT_ACCOUNT_INVALID',503,'O vínculo da sua conta de pagamentos precisa ser verificado.')
  stage='validate_urls'
  const origin=configuredAppUrl(),url=new URL(origin)
  if((process.env.VERCEL_ENV==='production'||process.env.NODE_ENV==='production')&&(url.protocol!=='https:'||['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.hostname.endsWith('.localhost')))throw new ConnectError('APP_URL_NOT_CONFIGURED',503,'A URL pública da aplicação ainda não está configurada.')
  stage='stripe_configuration'
  const stripe=getStripe()
  if(!connection){stage='create_account';context.account_creation=true;connection=await ensureConnectedAccount(database,user,stripe)}
  logOnboardingContext(connection.stripe_account_id,origin,{...context,stage})
  stage='create_account_link'
  const link=await createOnboardingLink(connection,stripe)
  return response.status(200).json({success:true,url:link.url})
 }catch(error){
  const status=onboardingFailureStatus(error)
  logOnboardingError(error?.cause||error,`onboarding.${stage}`,{...context,stage,response_status:status})
  const failure=error instanceof ConnectError?new ConnectError(error.code,status,error.message):new ConnectError('CONNECT_UNAVAILABLE',status,'Não foi possível acessar a configuração de pagamentos agora.')
  return fail(response,failure)
 }
}
