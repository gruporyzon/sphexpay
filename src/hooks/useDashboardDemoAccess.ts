import {useDashboardAdmin} from './useDashboardAdmin'
import {canAccessDemo,isDemoEmailAllowed} from '../lib/demoAccess'

export function useDashboardDemoAccess(userId:string|undefined,email:string|undefined){
 const admin=useDashboardAdmin(userId),emailAllowed=isDemoEmailAllowed(email)
 return{allowed:canAccessDemo(email,admin.allowed),loading:emailAllowed?false:admin.loading,error:emailAllowed?'':admin.error}
}
