import {createHash} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {serviceRoleKey,supabaseUrl} from '../push/config.js'
import {getStripe} from './client.js'

const table='stripe_connected_accounts'
const fields='user_id,stripe_account_id,stripe_account_type,stripe_onboarding_status,stripe_details_submitted,stripe_charges_enabled,stripe_payouts_enabled,stripe_requirements_currently_due,stripe_requirements_eventually_due,created_at,updated_at'

export class ConnectError extends Error{constructor(code,status,message){super(message);this.code=code;this.status=status}}
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
 if(error||!user)throw new ConnectError('UNAUTHORIZED',401,'Sua sessão expirou. Entre novamente.')
 return user
}
export async function findConnection(database,userId){
 const {data,error}=await database.from(table).select(fields).eq('user_id',userId).maybeSingle()
 if(error)throw new ConnectError('CONNECT_STORAGE_ERROR',503,'Não foi possível consultar sua configuração de pagamentos.')
 return data
}
const onboardingStatus=account=>{
 const due=account.requirements?.currently_due||[]
 if(account.charges_enabled&&account.payouts_enabled)return'enabled'
 if(account.details_submitted&&due.length)return'requirements_due'
 if(account.details_submitted)return'in_review'
 return'pending'
}
export const connectionRecord=(userId,account)=>({
 user_id:userId,stripe_account_id:account.id,stripe_account_type:account.type||'express',
 stripe_onboarding_status:onboardingStatus(account),stripe_details_submitted:Boolean(account.details_submitted),
 stripe_charges_enabled:Boolean(account.charges_enabled),stripe_payouts_enabled:Boolean(account.payouts_enabled),
 stripe_requirements_currently_due:account.requirements?.currently_due||[],
 stripe_requirements_eventually_due:account.requirements?.eventually_due||[],updated_at:new Date().toISOString()
})
export const safeStatus=record=>record?{
 connected:true,accountId:record.stripe_account_id,detailsSubmitted:Boolean(record.stripe_details_submitted),chargesEnabled:Boolean(record.stripe_charges_enabled),
 payoutsEnabled:Boolean(record.stripe_payouts_enabled),onboardingStatus:record.stripe_onboarding_status,
 requirements:{currentlyDue:record.stripe_requirements_currently_due||[],eventuallyDue:record.stripe_requirements_eventually_due||[]}
}:{connected:false,detailsSubmitted:false,chargesEnabled:false,payoutsEnabled:false,onboardingStatus:'not_connected',requirements:{currentlyDue:[],eventuallyDue:[]}}
// Only known database diagnostics may pass through; arbitrary text can contain PII.
const persistenceColumns=['user_id','stripe_account_id','stripe_account_type','stripe_onboarding_status','stripe_details_submitted','stripe_charges_enabled','stripe_payouts_enabled','stripe_requirements_currently_due','stripe_requirements_eventually_due','created_at','updated_at','id']
const persistenceConstraints=['user_id_key','stripe_account_id_key','account_id_format','stripe_account_type_check','stripe_onboarding_status_check','user_id_fkey','pkey'].map(suffix=>`${table}_${suffix}`)
const safePersistenceMessages=new Set([
 `permission denied for table ${table}`,
 `new row violates row-level security policy for table "${table}"`,
 `relation "public.${table}" does not exist`,
 `Could not find the table 'public.${table}' in the schema cache`,
 ...persistenceColumns.map(column=>`null value in column "${column}" of relation "${table}" violates not-null constraint`),
 ...persistenceConstraints.flatMap(constraint=>[
  `duplicate key value violates unique constraint "${constraint}"`,
  `new row for relation "${table}" violates check constraint "${constraint}"`,
  `insert or update on table "${table}" violates foreign key constraint "${constraint}"`
 ])
])
const logPersistenceError=error=>{
 // Never serialize the error or free-form details (e.g. PostgreSQL's failing row).
 // Logging failures must not change the existing error returned to the frontend.
 try{
  const safeText=value=>value==null?null:typeof value==='string'&&safePersistenceMessages.has(value)?value:'[REDACTED]'
  console.error('[Stripe Connect][Supabase persistence]',{
   code:typeof error.code==='string'&&/^(?:[0-9]{2}[A-Z0-9]{3}|PGRST[0-9]{3})$/.test(error.code)?error.code:null,
   message:safeText(error.message),details:safeText(error.details),hint:safeText(error.hint)
  })
 }catch{/* Diagnostics must not interfere with persistence error handling. */}
}
export async function ensureConnectedAccount(database,user,stripe=getStripe()){
 const existing=await findConnection(database,user.id)
 if(existing)return existing
 const idempotencyKey=`sphex-connect-${createHash('sha256').update(user.id).digest('hex')}`
 const account=await stripe.v2.core.accounts.create({contact_email:user.email||undefined,identity:{country:'br'},dashboard:'express',configuration:{merchant:{capabilities:{card_payments:{requested:true}}},recipient:{capabilities:{stripe_balance:{stripe_transfers:{requested:true}}}}},defaults:{responsibilities:{fees_collector:'application',losses_collector:'application'}},metadata:{sphex_user_id:user.id}},{idempotencyKey})
 const record=connectionRecord(user.id,account)
 const {data,error}=await database.from(table).upsert(record,{onConflict:'user_id'}).select(fields).single()
 if(error)logPersistenceError(error)
 if(error||!data)throw new ConnectError('CONNECT_STORAGE_ERROR',503,'A conta foi criada, mas não foi possível concluir o vínculo. Tente novamente.')
 return data
}
export async function retrieveAndSync(database,userId,connection,stripe=getStripe()){
 let account
 try{account=await stripe.accounts.retrieve(connection.stripe_account_id)}catch{throw new ConnectError('STRIPE_ACCOUNT_UNAVAILABLE',502,'Não foi possível consultar sua conta de pagamentos agora.')}
 if(account.deleted)throw new ConnectError('STRIPE_ACCOUNT_UNAVAILABLE',502,'Sua conta de pagamentos não está disponível.')
 const record=connectionRecord(userId,account)
 const {data,error}=await database.from(table).update(record).eq('user_id',userId).eq('stripe_account_id',connection.stripe_account_id).select(fields).single()
 if(error||!data)throw new ConnectError('CONNECT_STORAGE_ERROR',503,'Não foi possível atualizar o status da sua conta de pagamentos.')
 return data
}
const configuredAppUrl=()=>{
 const candidate=[process.env.APP_URL,process.env.VERCEL_PROJECT_PRODUCTION_URL&&`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,process.env.VERCEL_URL&&`https://${process.env.VERCEL_URL}`].find(Boolean)
 if(!candidate)throw new ConnectError('APP_URL_NOT_CONFIGURED',503,'A URL pública da aplicação ainda não está configurada.')
 try{const url=new URL(candidate);if(url.protocol!=='https:'&&url.hostname!=='localhost')throw new Error();return url.origin}catch{throw new ConnectError('APP_URL_NOT_CONFIGURED',503,'A URL pública da aplicação ainda não está configurada.')}
}
export async function createOnboardingLink(connection,stripe=getStripe()){
 const origin=configuredAppUrl()
 try{return await stripe.v2.core.accountLinks.create({account:connection.stripe_account_id,use_case:{type:'account_onboarding',account_onboarding:{configurations:['recipient'],refresh_url:`${origin}/app/financeiro/stripe/refresh`,return_url:`${origin}/app/financeiro/stripe/return`,collection_options:{fields:'eventually_due'}}}})}catch{throw new ConnectError('ONBOARDING_LINK_FAILED',502,'Não foi possível abrir a configuração da Stripe agora.')}
}
