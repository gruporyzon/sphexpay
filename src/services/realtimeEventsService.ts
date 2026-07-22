import { newLiveSale } from '../data/demo'
import type { Sale } from '../types'

type Listener=(sale:Sale)=>void
export const realtimeEventsService={
 subscribe(listener:Listener,frequencySeconds:number){const interval=window.setInterval(()=>listener(newLiveSale()),Math.max(5,frequencySeconds)*1000);return()=>window.clearInterval(interval)}
}
// Este adaptador usa eventos locais. Substitua a origem acima por WebSocket, SSE,
// Supabase Realtime, Firebase ou API própria quando o backend autorizado existir.
