import {configureProductPayments} from '../../../server/stripe/payments.js'
import {loadConnectedFinance} from '../../../server/stripe/finance.js'
import {listDisputes,refundSale,requireStepUp} from '../../../server/stripe/sales.js'
import {createCustomCharge,voidCustomCharge} from '../../../server/stripe/charges.js'
import {consumeRateLimit} from '../../../server/security/rateLimit.js'
import {recordSecurityEvent} from '../../../server/security/auditLog.js'
import {clientIp} from '../../../server/security/clientIp.js'
import {resolveWorkspace} from '../../../server/security/teamAccess.js'
import {ConnectError,authenticate,fail,findConnection,parseJsonBody,retrieveAndSync,safeStatus,serverDatabase,tokenFrom} from '../../../server/stripe/connect.js'

// Um único handler para o painel (limite de funções da Vercel): status da conta, finanças,
// contestações (GET ?view=), métodos de pagamento do produto, reembolso e cobranças (POST ?action=).
export default async function handler(request,response){
 response.setHeader('Cache-Control','no-store')
 if(!['GET','POST'].includes(request.method))return response.status(405).json({success:false,code:'METHOD_NOT_ALLOWED',message:'Método não permitido.'})
 try{const database=serverDatabase(),user=await authenticate(request,database)
  if(request.method==='POST'){
   const input=parseJsonBody(request)
   if(request.query?.action==='refund'){
    requireStepUp(user,tokenFrom(request))
    if(!consumeRateLimit(`refund:${user.id}`,{limit:10,windowMs:10*60000}).allowed)throw new ConnectError('RATE_LIMITED',429,'Muitos reembolsos em sequência. Aguarde alguns minutos.')
    const result=await refundSale(database,user,input)
    await recordSecurityEvent(database,{eventType:'sale_refund_requested',actorId:user.id,ip:clientIp(request),userAgent:request.headers?.['user-agent'],metadata:{refund_id:result.refundId,amount_cents:result.amountCents,currency:result.currency}})
    return response.status(200).json({success:true,...result})
   }
   if(request.query?.action==='charge'){
    if(!consumeRateLimit(`charge:${user.id}`,{limit:20,windowMs:10*60000}).allowed)throw new ConnectError('RATE_LIMITED',429,'Muitas cobranças em sequência. Aguarde alguns minutos.')
    return response.status(200).json({success:true,...await createCustomCharge(database,user,input)})
   }
   if(request.query?.action==='void-charge')return response.status(200).json({success:true,...await voidCustomCharge(database,user,input)})
   return response.status(200).json({success:true,...await configureProductPayments(database,user,input)})
  }
  // Leitura da conta de quem convidou (?seller=) só para colaborador ativo com o cargo certo.
  if(request.query?.view==='finance')return response.status(200).json({success:true,...await loadConnectedFinance(database,await resolveWorkspace(database,user,request.query?.seller,'finance.read'))})
  if(request.query?.view==='disputes')return response.status(200).json({success:true,...await listDisputes(database,await resolveWorkspace(database,user,request.query?.seller,'disputes.read'))})
  const connection=await findConnection(database,user.id,true);if(!connection)return response.status(200).json({success:true,...safeStatus(null)});const current=await retrieveAndSync(database,user.id,connection);return response.status(200).json({success:true,...safeStatus(current)})}catch(error){
  if(request.method==='GET'){
   if(['CONNECT_STORAGE_ERROR','SERVER_NOT_CONFIGURED','STRIPE_NOT_CONFIGURED'].includes(error?.code))return fail(response,new ConnectError(error.code,500,'Não foi possível atualizar a configuração de pagamentos.'))
   if(error?.code==='AUTH_UNAVAILABLE')return fail(response,new ConnectError(error.code,502,error.message))
   if(!(error instanceof ConnectError))return fail(response,new ConnectError('CONNECT_INTERNAL_ERROR',500,'Não foi possível atualizar o status da sua conta de pagamentos.'))
  }
  return fail(response,error)
 }
}
