// Tipos de server/notifications/revenueMessages.js (usado também pelas telas).
export type ReminderStyle='professional'|'humor'|'mixed'
export type ReminderInput={hour:number;revenueCents:number;sales:number;style:ReminderStyle;firstName?:string;seed:number}
export declare const REMINDER_HOURS:readonly [0,8,12,15,18,20]
export declare const STYLE_LABEL:Record<ReminderStyle,string>
export declare function formatBRL(cents:number):string
export declare function buildRevenueReminder(input:ReminderInput):{title:string;body:string;style:Exclude<ReminderStyle,'mixed'>}
export declare function buildSaleNotification(status:'approved'|'pending',amountCents:number,currency?:string):{title:string;body:string}
