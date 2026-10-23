// Modo Demo: exclusivo do e-mail administrador do gateway. Roda só no navegador e nunca grava
// em tabelas financeiras reais.
export const DEMO_EMAIL_ALLOWLIST=new Set([
 'gruporyzon@gmail.com',
])

export const normalizeDemoEmail=(email:string|undefined|null)=>email?.trim().toLowerCase()??''

export const isDemoEmailAllowed=(email:string|undefined|null)=>DEMO_EMAIL_ALLOWLIST.has(normalizeDemoEmail(email))

// O cargo de administrador não libera sozinho: o acesso é só pelo e-mail da lista.
export const canAccessDemo=(email:string|undefined|null)=>isDemoEmailAllowed(email)
