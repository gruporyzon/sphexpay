import { supabase } from '../lib/supabase'

export interface LiveOperationsStatus{
 webhookConfigured:boolean;realtimeTable:string;pushConfigured:boolean;
 lastTransactionAt:string|null;lastApprovedAt:string|null;lastPushAt:string|null;
 activeDevices:number;pendingEvents:number;failedEvents:number
}

export const liveOperationsService={
 async load():Promise<LiveOperationsStatus>{
  if(!supabase)throw new Error('OPERATIONS_UNAVAILABLE')
  const {data}=await supabase.auth.getSession()
  const token=data.session?.access_token
  if(!token)throw new Error('OPERATIONS_UNAUTHORIZED')
  const response=await fetch('/api/payments/health',{headers:{Authorization:`Bearer ${token}`}})
  if(!response.ok)throw new Error(response.status===403?'OPERATIONS_FORBIDDEN':'OPERATIONS_UNAVAILABLE')
  return response.json() as Promise<LiveOperationsStatus>
 },
 async testPush(){
  if(!supabase)throw new Error('OPERATIONS_UNAVAILABLE')
  const {data}=await supabase.auth.getSession()
  const token=data.session?.access_token
  if(!token)throw new Error('OPERATIONS_UNAUTHORIZED')
  const response=await fetch('/api/push/send',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({type:'infrastructure_test',eventId:`infrastructure-test-${Date.now()}`})})
  if(!response.ok)throw new Error('PUSH_TEST_FAILED')
 }
}
