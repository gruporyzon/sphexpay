export type SaleStatus = 'Aprovado' | 'Pendente' | 'Recusado' | 'Reembolsado' | 'Em análise'
export type PaymentMethod = 'Pix' | 'Cartão de crédito' | 'Boleto' | 'Assinatura'
export type Theme = 'light' | 'dark'
export type PeriodPreset = 'today'|'yesterday'|'7d'|'30d'|'month'|'lastMonth'|'custom'
export interface PeriodFilter { preset:PeriodPreset; from?:string; to?:string }
export interface ShippingAddress { recipient:string; postalCode:string; street:string; number:string; complement:string; district:string; city:string; state:string; country:string; phone:string; reference:string }

export interface Sale { id:string; customer:string; email:string; product:string; amount:number; currency:'BRL'|'USD'|'EUR'; method:PaymentMethod; status:SaleStatus; date:string; country:string; fee:number }
export interface Product { id:string; name:string; description:string; price:number; billing:'Única'|'Recorrente'; monthly?:number; annual?:number; active:boolean; sales:number; revenue:number; color:string }
export interface Customer { id:string; name:string; email:string; phone:string; country:string; spent:number; purchases:number; lastPurchase:string; products:string[]; status:'Ativo'|'Inativo' }
export interface Subscription { id:string; customer:string; plan:string; status:'Ativa'|'Cancelada'|'Inadimplente'|'Período gratuito'; amount:number; nextCharge:string }
export interface ChartPoint { label:string; revenue:number; profit:number; sales:number }
export type AwardRequestStatus='Disponível para solicitar'|'Endereço pendente'|'Solicitação recebida'|'Em preparação'|'Enviada'|'Entregue'
export interface AwardRequest { id:string; requestedAt:string; status:AwardRequestStatus; address:ShippingAddress; updatedAt:string }
export interface Achievement { id:string; title:string; target:number; redeemed:boolean; address?:ShippingAddress; request?:AwardRequest; requestHistory?:AwardRequest[] }
export interface Withdrawal { id:string; amount:number; date:string; status:'Processando'|'Concluído'; account:string }
export type NotificationCategory = 'Vendas'|'Financeiro'|'Saques'|'Assinaturas'|'Segurança'|'Sistema'
export type NotificationKind = 'sale'|'payment'|'subscription'|'withdrawal'|'achievement'|'goal'|'security'|'system'
export type NotificationPriority='critical'|'high'|'normal'|'low'
export type CommerceNotificationType='sale_approved'|'pix_generated'|'credit_card_approved'|'boleto_generated'|'subscription_approved'|'subscription_renewed'|'refund_done'|'chargeback_received'|'withdrawal_sent'|'sale_pending'|'payment_refused'
export interface NotificationMetadata { buyer?:string; product?:string; amount?:number; commission?:number|null; currency?:Sale['currency']; method?:PaymentMethod; status?:string; country?:string; eventType?:CommerceNotificationType; source?:'backend'|'local'|'manual'|'test' }
export interface AppNotification { id:string; kind:NotificationKind; category:NotificationCategory; title:string; description:string; createdAt:string; read:boolean; archived?:boolean; priority?:NotificationPriority; detailPath?:string; metadata?:NotificationMetadata }
export type NotificationFrequency='realtime'|'1ps'|'2ps'|'5ps'|'5s'|'15s'|'30s'|'60s'|'digest5m'
export interface NotificationPreferences { internal:boolean; device:boolean; sales:boolean; withdrawals:boolean; subscriptions:boolean; security:boolean; achievements:boolean; sound:boolean; vibration:boolean; frequency:NotificationFrequency; groupSimilar:boolean; muteRepeated:boolean; priorityApproved:boolean; priorityPix:boolean; priorityCard:boolean; saleApproved?:boolean; pixGenerated?:boolean; cardApproved?:boolean; subscriptionEvents?:boolean; withdrawalEvents?:boolean; soundVolume:number; soundStyle:'signal'|'pulse'|'soft'; quietHours:boolean; quietFrom:string; quietTo:string; doNotDisturb:boolean; importantOnly:boolean }
export interface AssistantPreferences { microphone:boolean; readAloud:boolean; voice:string; voiceGender:'female'|'male'|'auto'; language:string; speechRate:number; pitch:number; volume:number; interruptOnSend:boolean; autoSendVoice:boolean }
export interface SalesPreferences { automaticUpdates:boolean; updateFrequency:number; saleSound:boolean; showNotifications:boolean; recentCount:number }
export interface AppPreferences { notifications:NotificationPreferences; assistant:AssistantPreferences; sales:SalesPreferences }
export interface DemoState { storageVersion:number; revenue:number; available:number; pending:number; goal:number; period:PeriodFilter; sales:Sale[]; products:Product[]; customers:Customer[]; subscriptions:Subscription[]; chart:ChartPoint[]; achievements:Achievement[]; withdrawals:Withdrawal[]; notifications:AppNotification[]; preferences:AppPreferences; liveSales:boolean; theme:Theme }
