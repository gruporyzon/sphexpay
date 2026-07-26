import type { Sale } from '../types'

type Listener=(sale:Sale)=>void
export const realtimeEventsService={
 subscribe(listener:Listener,frequencySeconds:number){
  void listener
  void frequencySeconds
  return()=>undefined
 }
}
// Nenhuma venda é criada no frontend. Um provedor oficial deverá alimentar este
// adaptador por WebSocket, SSE ou Supabase Realtime após confirmação no servidor.
