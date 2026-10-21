// Nunca registra destinatários, conteúdo ou a chave. A mesma chave idempotente é
// mantida durante retentativas para evitar e-mails duplicados após timeout.
export async function sendEmail(input:{apiKey:string;from:string;to:string[];subject:string;html:string;text:string;idempotencyKey:string},request:typeof fetch=fetch){
 if(!input.apiKey||!input.to.length)return {ok:false,retryable:true}
 try{
  const response=await request('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(8000),headers:{Authorization:`Bearer ${input.apiKey}`,'Content-Type':'application/json','Idempotency-Key':input.idempotencyKey},body:JSON.stringify({from:input.from,to:input.to,subject:input.subject.replace(/[\r\n\t]+/g,' ').slice(0,180),html:input.html,text:input.text})})
  return {ok:response.ok,retryable:response.status===429||response.status>=500}
 }catch{return {ok:false,retryable:true}}
}
