export interface PushSubscriptionAdapter{subscribe(userId:string):Promise<PushSubscription>;unsubscribe():Promise<boolean>;current():Promise<PushSubscription|null>}
export interface PushBackendAdapter{saveSubscription(userId:string,subscription:PushSubscription):Promise<void>;removeSubscription(endpoint:string):Promise<void>}
export const pushSubscriptionService={supported(){return 'serviceWorker'in navigator&&'PushManager'in window},async current(){if(!this.supported())return null;const registration=await navigator.serviceWorker.ready;return registration.pushManager.getSubscription()}}

// A assinatura exige backend autorizado, identificação de usuário e chave pública VAPID.
// Nenhuma chave, endpoint ou inscrição é inventada no cliente local.
