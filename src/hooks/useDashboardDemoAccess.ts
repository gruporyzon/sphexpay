import {canAccessDemo} from '../lib/demoAccess'

// Acesso ao modo Demo: decidido só pelo e-mail da conta (ver lib/demoAccess).
export function useDashboardDemoAccess(_userId:string|undefined,email:string|undefined){
 return{allowed:canAccessDemo(email),loading:false,error:''}
}
