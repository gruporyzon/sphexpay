export const AUTH_ENTRANCE_PENDING_KEY='sphexpay.authEntrancePending'
export const AUTH_ENTRANCE_PLAYED_KEY='sphexpay.authEntrancePlayed'

export function markAuthEntrancePending(){try{sessionStorage.setItem(AUTH_ENTRANCE_PENDING_KEY,'true');sessionStorage.removeItem(AUTH_ENTRANCE_PLAYED_KEY)}catch{/* storage indisponível não pode bloquear o login */}}
export function shouldPlayAuthEntrance(){try{return sessionStorage.getItem(AUTH_ENTRANCE_PENDING_KEY)==='true'&&sessionStorage.getItem(AUTH_ENTRANCE_PLAYED_KEY)!=='true'}catch{return true}}
export function consumeAuthEntrance(){try{sessionStorage.removeItem(AUTH_ENTRANCE_PENDING_KEY);sessionStorage.setItem(AUTH_ENTRANCE_PLAYED_KEY,'true')}catch{/* o gate mantém seu estado em memória */}}
export function clearAuthEntranceState(){try{sessionStorage.removeItem(AUTH_ENTRANCE_PENDING_KEY);sessionStorage.removeItem(AUTH_ENTRANCE_PLAYED_KEY)}catch{/* logout continua mesmo sem storage */}}
