import { newLiveSale } from '../data/demo'
import type { Sale } from '../types'

type Listener=(sale:Sale)=>void
export const realtimeEventsService={
 subscribe(listener:Listener,frequencySeconds:number){const delay=Math.max(5,frequencySeconds)*1000;let tick=0;const interval=window.setInterval(()=>{tick+=1;listener(newLiveSale(Math.floor(Date.now()/delay)*delay+tick))},delay);return()=>window.clearInterval(interval)}
}
// Este adaptador usa eventos locais. Substitua a origem acima por WebSocket, SSE,
// Supabase Realtime, Firebase ou API própria quando o backend autorizado existir.
