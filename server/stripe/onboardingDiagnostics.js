// Only technical messages without interpolated customer data may be logged verbatim.
// Unknown/free-form messages stay redacted; request_id correlates the Stripe log.
const technicalMessages=new Set([
 'Accounts v2 is not enabled for your platform.',
 'Account cannot be onboard via v2/core/account_links without specifying the right configurations.',
 'The resource wasn’t found.',
 'The resource was not found.',
 'Account cannot exceed a configured concurrency rate limit on updates.',
 'An error occurred with our connection to Stripe.',
 'Request aborted due to timeout being reached (5000ms)',
 'Stripe returned an invalid onboarding URL.',
 'Stripe returned an onboarding link for a different account.'
])
const technicalField=value=>typeof value==='string'&&value.length<=160&&/^[A-Za-z][A-Za-z0-9_.\[\]-]*$/.test(value)&&!/(?:secret|token|authorization|sk_live|sk_test|rk_live|rk_test)/i.test(value)?value:null
const safeContext=context=>({
 diagnostic_id:typeof context.diagnostic_id==='string'&&/^[a-f0-9-]{36}$/.test(context.diagnostic_id)?context.diagnostic_id:null,
 stage:technicalField(context.stage),
 connection_exists:typeof context.connection_exists==='boolean'?context.connection_exists:null,
 onboarding_action:context.account_creation===true?'create_account':context.connection_exists===true?'resume_existing_account':'not_started',
 account_creation:context.account_creation===true,
 link_action:'create_account_link',
 vercel_environment:['production','preview','development'].includes(process.env.VERCEL_ENV)?process.env.VERCEL_ENV:'unknown',
 app_url_source:process.env.APP_URL?'APP_URL':process.env.VERCEL_PROJECT_PRODUCTION_URL?'VERCEL_PROJECT_PRODUCTION_URL':process.env.VERCEL_URL?'VERCEL_URL':'missing',
 stripe_key_mode:/^(?:sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY?.trim()||'')?'test':/^(?:sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY?.trim()||'')?'live':'unknown',
 response_status:Number.isInteger(context.response_status)?context.response_status:null
})
export function onboardingFailureStatus(error){
 const source=error?.cause||error,code=source?.code,type=source?.type,status=source?.statusCode
 if(['SERVER_NOT_CONFIGURED','APP_URL_NOT_CONFIGURED','CONNECT_ACCOUNT_INVALID','STRIPE_NOT_CONFIGURED'].includes(error?.code))return 500
 if(error?.code==='CONNECT_STORAGE_ERROR'&&/^(?:42|23|PGRST20)/.test(code||''))return 500
 if(['resource_missing','not_found'].includes(code)||status===404)return 409
 if(type==='StripeRateLimitError'||status===429)return 503
 if(type==='StripeAuthenticationError'||type==='StripePermissionError'||type==='StripeInvalidRequestError'||[400,401,403].includes(status))return 500
 if(type==='StripeConnectionError')return /timeout|timed out/i.test(source?.message||'')?504:502
 if(type==='StripeAPIError'||type==='StripeResponseError'||status>=500)return 502
 if(error?.code==='ONBOARDING_LINK_FAILED')return 500
 return [401,403,409,503].includes(error?.status)?error.status:500
}
export function logOnboardingError(error,operation='v2.core.accountLinks.create',context){
 try{
  const requestId=error?.requestId??error?.request_id??error?.raw?.requestId??error?.raw?.request_id
  console.error('[Stripe Connect][Onboarding]',{
   ...(context?{...safeContext(context),stripe_http_status:context.stage==='create_account_link'&&Number.isInteger(error?.statusCode)&&error.statusCode>=100&&error.statusCode<=599?error.statusCode:null}:{}),
   operation:technicalField(operation),
   type:technicalField(error?.type??error?.raw?.type),
   code:technicalField(error?.code??error?.raw?.code),
   param:technicalField(error?.param??error?.raw?.param),
   message:technicalMessages.has(error?.message)?error.message:'[REDACTED]',
   statusCode:Number.isInteger(error?.statusCode??error?.status)&&(error.statusCode??error.status)>=100&&(error.statusCode??error.status)<=599?(error.statusCode??error.status):null,
   raw:{type:technicalField(error?.raw?.type),code:technicalField(error?.raw?.code),message:technicalMessages.has(error?.raw?.message)?error.raw.message:error?.raw?.message==null?null:'[REDACTED]'},
   request_id:typeof requestId==='string'&&/^req_[A-Za-z0-9]{1,100}$/.test(requestId)?requestId:null
  })
 }catch{/* Logging must never replace the original failure. */}
}

export function logOnboardingContext(accountId,origin,context){
 try{
  console.info('[Stripe Connect][Onboarding context]',{
   ...(context?safeContext(context):{}),
   operation:'v2.core.accountLinks.create',
   account_reference:'acct_…'+accountId.slice(-6),
   account_source:'persisted_connection',
   return_url:`${origin}/app/financeiro/stripe/return`,
   refresh_url:`${origin}/app/financeiro/stripe/refresh`
  })
 }catch{/* Context logging must not interfere with onboarding. */}
}
