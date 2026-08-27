export const DEMO_EMAIL_ALLOWLIST=new Set([
 'ironaldydriguez@gmail.com',
 'kaysilva15@icloud.com',
])

export const normalizeDemoEmail=(email:string|undefined|null)=>email?.trim().toLowerCase()??''

export const isDemoEmailAllowed=(email:string|undefined|null)=>DEMO_EMAIL_ALLOWLIST.has(normalizeDemoEmail(email))

export const canAccessDemo=(email:string|undefined|null,isAdmin:boolean)=>isAdmin||isDemoEmailAllowed(email)
