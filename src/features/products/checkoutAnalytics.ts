import { supabase } from '../../lib/supabase'

// Visitas e inícios de pagamento do checkout público. Melhor esforço: nunca bloqueia a compra.
// A sessão é um identificador aleatório por aba, sem dado pessoal; o banco deduplica por 30 min.
const SESSION_KEY='sphexpay:checkout-session'

function sessionId(){
 try{
  const saved=sessionStorage.getItem(SESSION_KEY)
  if(saved&&saved.length>=8)return saved
  const created=crypto.randomUUID()
  sessionStorage.setItem(SESSION_KEY,created)
  return created
 }catch{return crypto.randomUUID()}
}

export function recordCheckoutEvent(checkoutId:string,eventType:'page_view'|'checkout_started'){
 if(!supabase)return
 void supabase.rpc('record_checkout_event',{p_checkout_id:checkoutId,p_event_type:eventType,p_session_id:sessionId()}).then(()=>undefined,()=>undefined)
}
