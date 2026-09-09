import {createHash} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {serviceRoleKey,supabaseUrl} from '../push/config.js'
import {getStripe,getStripeMode} from './client.js'
import {logOnboardingError} from './onboardingDiagnostics.js'

const table='stripe_connected_accounts'
const fields='stripe_mode,user_id,stripe_account_id,stripe_account_type,stripe_capabilities,stripe_onboarding_status,stripe_details_submitted,stripe_charges_enabled,stripe_payouts_enabled,stripe_requirements_currently_due,stripe_requirements_eventually_due,created_at,updated_at'

export class ConnectError extends Error{constructor(code,status,message){super(message);this.code=code;this.status=status}}
export function parseJsonBody(request){
 try{return typeof request.body==='string'?JSON.parse(request.body):request.body}
 catch{throw new ConnectError('INVALID_JSON',400,'Envie um corpo JSON válido.')}
}
export const fail=(response,error)=>{
 const known=error instanceof ConnectError?error:new ConnectError('CONNECT_UNAVAILABLE',502,'Não foi possível acessar a configuração de pagamentos agora.')
 return response.status(known.status).json({success:false,code:known.code,message:known.message})
}
export const tokenFrom=request=>String(request.headers?.authorization||'').replace(/^Bearer\s+/i,'').trim()
export function serverDatabase(){
 const url=supabaseUrl(),key=serviceRoleKey()
 if(!url||!key)throw new ConnectError('SERVER_NOT_CONFIGURED',503,'A integração de pagamentos ainda não está configurada.')
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
}
export async function authenticate(request,database){
 const token=tokenFrom(request)
 if(!token)throw new ConnectError('UNAUTHORIZED',401,'Sua sessão expirou. Entre novamente.')
 const {data:{user},error}=await database.auth.getUser(token)
 if(error?.status>=500||error?.name==='AuthRetryableFetchError')throw new ConnectError('AUTH_UNAVAILABLE',503,'Não foi possível verificar sua sessão agora. Tente novamente.')
 if(error||!user)throw new ConnectError('UNAUTHORIZED',401,'Sua sessão expirou. Entre novamente.')
 return user
}
export async function findConnection(database,userId,diagnostics){
 const {data,error,status}=await database.from(table).select(fields).eq('user_id',userId).eq('stripe_mode',getStripeMode()).maybeSingle()
 if(error){logPersistenceError(error,diagnostics?'GET':'find_connection',diagnostics?{stage:'find_connection',status}:undefined);const failure=new ConnectError('CONNECT_STORAGE_ERROR',503,'Não foi possível consultar sua configuração de pagamentos.');Object.defineProperty(failure,'cause',{value:error});throw failure}
 if(data)assertConnectionMode(data)
 return data
}
export function assertConnectionMode(connection){
 if(!connection||connection.stripe_mode!==getStripeMode())throw new ConnectError('CONNECT_MODE_MISMATCH',409,'A conta não pertence ao modo Stripe configurado.')
}
const onboardingStatus=account=>{
 // Canonical database contract. Never copy a Stripe status string or metadata.
 const requirements=account.requirements||{}
 if(requirements.currently_due?.length||requirements.past_due?.length)return'requirements_due'
 if(!account.details_submitted)return'pending'
 if(account.charges_enabled&&account.payouts_enabled&&!requirements.disabled_reason&&!requirements.pending_verification?.length)return'enabled'
 return'in_review'
}
export const connectionRecord=(userId,account)=>({
 stripe_mode:getStripeMode(),user_id:userId,stripe_account_id:account.id,stripe_account_type:account.type||'express',stripe_capabilities:account.capabilities||{},
 stripe_onboarding_status:onboardingStatus(account),stripe_details_submitted:Boolean(account.details_submitted),
 stripe_charges_enabled:Boolean(account.charges_enabled),stripe_payouts_enabled:Boolean(account.payouts_enabled),
 stripe_requirements_currently_due:account.requirements?.currently_due||[],
 stripe_requirements_eventually_due:account.requirements?.eventually_due||[],updated_at:new Date().toISOString()
})
export const safeStatus=record=>{
 if(record)assertConnectionMode(record)
 return record?{
 mode:getStripeMode(),onboardingComplete:Boolean(record.stripe_details_submitted),
 connected:true,accountId:record.stripe_account_id,detailsSubmitted:Boolean(record.stripe_details_submitted),chargesEnabled:Boolean(record.stripe_charges_enabled),
 payoutsEnabled:Boolean(record.stripe_payouts_enabled),onboardingStatus:record.stripe_onboarding_status,
 requirements:{currentlyDue:record.stripe_requirements_currently_due||[],eventuallyDue:record.stripe_requirements_eventually_due||[]}
}:{mode:getStripeMode(),onboardingComplete:false,connected:false,detailsSubmitted:false,chargesEnabled:false,payoutsEnabled:false,onboardingStatus:'not_connected',requirements:{currentlyDue:[],eventuallyDue:[]}}
}
// Only known database diagnostics may pass through; arbitrary text can contain PII.
const persistenceColumns=fields.split(',').concat('id')
const persistenceConstraints=['user_mode_key','stripe_mode_check','user_id_key','stripe_account_id_key','account_id_format','stripe_account_type_check','stripe_onboarding_status_check','user_id_fkey','pkey'].map(suffix=>`${table}_${suffix}`)
const safePersistenceMessages=new Set([
 `permission denied for table ${table}`,
 `new row violates row-level security policy for table "${table}"`,
 `relation "public.${table}" does not exist`,
 `Could not find the table 'public.${table}' in the schema cache`,
 'CONNECT_IDENTITY_IMMUTABLE',
 ...persistenceColumns.map(column=>`Could not find the '${column}' column of '${table}' in the schema cache`),
 ...persistenceColumns.map(column=>`null value in column "${column}" of relation "${table}" violates not-null constraint`),
 ...persistenceConstraints.flatMap(constraint=>[
  `duplicate key value violates unique constraint "${constraint}"`,
  `new row for relation "${table}" violates check constraint "${constraint}"`,
  `insert or update on table "${table}" violates foreign key constraint "${constraint}"`
 ])
])
const logPersistenceError=(error,operation,context)=>{
 // Never serialize the error or free-form details (e.g. PostgreSQL's failing row).
 // Logging failures must not change the existing error returned to the frontend.
 try{
  const safeText=value=>value==null?null:typeof value==='string'&&safePersistenceMessages.has(value)?value:'[REDACTED]'
  console.error('[Stripe Connect][Supabase persistence]',{
   ...(operation?{operation}:{}),
   ...(context?{stage:context.stage,mode:getStripeMode(),status:Number.isInteger(context.status)&&context.status>=100&&context.status<=599?context.status:null}:{}),
   code:typeof error.code==='string'&&/^(?:[0-9]{2}[A-Z0-9]{3}|PGRST[0-9]{3})$/.test(error.code)?error.code:null,
   message:safeText(error.message),details:safeText(error.details),hint:safeText(error.hint)
  })
 }catch{/* Diagnostics must not interfere with persistence error handling. */}
}
// Temporary shape-only diagnostic: never log the ID or coerce non-string values.
const logAccountIdDiagnostic=id=>{
 try{
  const isString=typeof id==='string'
  const startsWithAcct=isString?id.startsWith('acct_'):null
  console.info('[Stripe Connect][Account ID diagnostic]',{
   type:typeof id,
   length:isString?id.length:null,
   prefix:startsWithAcct&&id.length>5?'acct_':null,
   startsWithAcct,
   underscoreCount:isString?(id.match(/_/g)||[]).length:null,
   onlySafeCharacters:isString?/^[A-Za-z0-9_]+$/.test(id):null,
   matchesCurrentConstraint:isString?/^acct_[A-Za-z0-9]+$/.test(id):null,
   containsWhitespace:isString?/\s/.test(id):null,
   containsUnexpectedCharacters:isString?/[^A-Za-z0-9_]/.test(id):null
  })
 }catch{/* Diagnostics must not interfere with persistence. */}
}
// Temporary pre-PATCH diagnostic from the exact record sent to Supabase.
// Only derived literals, booleans and counts; never serialize Account or IDs.
const logStatusDiagnostic=record=>{
 try{
  console.info('[Stripe Connect][Status diagnostic]',{
   stage:'persist_status',mode:record.stripe_mode,
   derived_onboarding_status:record.stripe_onboarding_status,
   details_submitted:record.stripe_details_submitted,
   charges_enabled:record.stripe_charges_enabled,
   payouts_enabled:record.stripe_payouts_enabled,
   currently_due_count:record.stripe_requirements_currently_due.length
  })
 }catch{/* Diagnostics must not interfere with persistence. */}
}
export async function ensureConnectedAccount(database,user,stripe=getStripe()){
 const existing=await findConnection(database,user.id)
 if(existing){
  if(existing.user_id!==user.id)throw new ConnectError('CONNECT_OWNERSHIP_MISMATCH',403,'Conta de pagamentos incompatível com o usuário.')
  return existing
 }
 const idempotencyKey=`sphex-connect-${createHash('sha256').update(`${getStripeMode()}:${user.id}`).digest('hex')}`
 const parameters={contact_email:user.email||undefined,identity:{country:'br'},dashboard:'express',configuration:{merchant:{capabilities:{card_payments:{requested:true}}},recipient:{capabilities:{stripe_balance:{stripe_transfers:{requested:true}}}}},defaults:{responsibilities:{fees_collector:'application',losses_collector:'application'}},metadata:{sphex_user_id:user.id}}
 // Persist the exact request before Stripe; never retry beyond its retention window.
 const {data:reservation,error:reservationError}=await database.rpc('reserve_stripe_account_for_mode',{p_user_id:user.id,p_mode:getStripeMode(),p_parameters:parameters})
 if(reservationError?.message==='CONNECT_LEGACY_CLASSIFICATION_REQUIRED')throw new ConnectError('CONNECT_LEGACY_CLASSIFICATION_REQUIRED',409,'Existe um vínculo anterior que precisa ser classificado antes de criar uma conta Live. Contate o suporte.')
 if(reservationError||!reservation)throw new ConnectError('CONNECT_RECONCILIATION_REQUIRED',503,'Não foi possível reservar a conta com segurança. Verifique a configuração ou reconcilie a tentativa anterior.')
 const account=await stripe.v2.core.accounts.create(reservation,{idempotencyKey})
 const record=connectionRecord(user.id,account)
 logAccountIdDiagnostic(account.id)
 const {data,error}=await database.from(table).upsert(record,{onConflict:'user_id,stripe_mode'}).select(fields).single()
 if(error)logPersistenceError(error)
 if(error||!data)throw new ConnectError('CONNECT_STORAGE_ERROR',503,'A conta foi criada, mas não foi possível concluir o vínculo. Tente novamente.')
 return data
}
export async function retrieveAndSync(database,userId,connection,stripe=getStripe()){
 assertConnectionMode(connection)
 if(connection.user_id!==userId)throw new ConnectError('CONNECT_OWNERSHIP_MISMATCH',403,'Conta de pagamentos incompatível com o usuário.')
 let account
 try{account=await stripe.accounts.retrieve(connection.stripe_account_id)}catch(error){
  const temporary=['StripeConnectionError','StripeRateLimitError','StripeAPIError'].includes(error?.type)||error?.statusCode===429||error?.statusCode>=500
  const internal=['StripeAuthenticationError','StripePermissionError','StripeInvalidRequestError'].includes(error?.type)||[400,401,403].includes(error?.statusCode)
  throw new ConnectError(temporary?'STRIPE_ACCOUNT_UNAVAILABLE':internal?'STRIPE_CONFIGURATION_ERROR':'STRIPE_ACCOUNT_ERROR',temporary?503:internal?500:502,'Não foi possível consultar sua conta de pagamentos agora.')
 }
 if(connection.user_id!==userId||account.id!==connection.stripe_account_id||(account.metadata?.sphex_user_id&&account.metadata.sphex_user_id!==userId))throw new ConnectError('CONNECT_OWNERSHIP_MISMATCH',403,'Conta de pagamentos incompatível com o usuário.')
 if(account.deleted)throw new ConnectError('STRIPE_ACCOUNT_UNAVAILABLE',502,'Sua conta de pagamentos não está disponível.')
 // Accounts v2 can appear as type `none` through v1. Status refreshes must
 // preserve the local Express setup instead of violating its database constraint.
 const record={...connectionRecord(userId,account),stripe_account_type:connection.stripe_account_type}
 logStatusDiagnostic(record)
 try{
  const {data,error,status}=await database.from(table).update(record).eq('user_id',userId).eq('stripe_mode',getStripeMode()).eq('stripe_account_id',connection.stripe_account_id).select(fields).single()
  if(error||!data){
   logPersistenceError(error||{code:'PGRST116',message:'No status row returned'},'PATCH',{stage:'persist_status',status})
   throw new ConnectError('CONNECT_STORAGE_ERROR',500,'Não foi possível atualizar o status da sua conta de pagamentos.')
  }
  return data
 }catch(error){
  if(error instanceof ConnectError)throw error
  logPersistenceError(error||{},'PATCH',{stage:'persist_status',status:error?.status})
  throw new ConnectError('CONNECT_STORAGE_ERROR',500,'Não foi possível atualizar o status da sua conta de pagamentos.')
 }
}
export const configuredAppUrl=()=>{
 const candidate=[process.env.APP_URL,process.env.VERCEL_PROJECT_PRODUCTION_URL&&`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,process.env.VERCEL_URL&&`https://${process.env.VERCEL_URL}`].find(Boolean)
 if(!candidate)throw new ConnectError('APP_URL_NOT_CONFIGURED',503,'A URL pública da aplicação ainda não está configurada.')
 try{const url=new URL(candidate);if(url.username||url.password||!(url.protocol==='https:'||(url.protocol==='http:'&&url.hostname==='localhost')))throw new Error();return url.origin}catch{throw new ConnectError('APP_URL_NOT_CONFIGURED',503,'A URL pública da aplicação ainda não está configurada.')}
}
export async function createOnboardingLink(connection,stripe=getStripe()){
 assertConnectionMode(connection)
 const origin=configuredAppUrl()
 try{
  const link=await stripe.v2.core.accountLinks.create({account:connection.stripe_account_id,use_case:{type:'account_onboarding',account_onboarding:{configurations:['merchant','recipient'],refresh_url:`${origin}/app/financeiro/stripe/refresh`,return_url:`${origin}/app/financeiro/stripe/return`,collection_options:{fields:'eventually_due'}}}})
  let url
  try{url=typeof link?.url==='string'?new URL(link.url):null}catch{/* Invalid Stripe response handled below. */}
  if(!url||url.protocol!=='https:'||url.username||url.password)throw Object.assign(new Error('Stripe returned an invalid onboarding URL.'),{type:'StripeResponseError',code:'invalid_onboarding_url',requestId:link?.lastResponse?.requestId})
  if(link.account&&link.account!==connection.stripe_account_id)throw Object.assign(new Error('Stripe returned an onboarding link for a different account.'),{type:'StripeResponseError',code:'onboarding_account_mismatch',requestId:link?.lastResponse?.requestId})
  return link
 }catch(error){
  logOnboardingError(error)
  const failure=new ConnectError('ONBOARDING_LINK_FAILED',502,'Não foi possível abrir a configuração da Stripe agora.')
  Object.defineProperty(failure,'cause',{value:error})
  throw failure
 }
}
