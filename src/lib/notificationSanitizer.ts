const brandedPrefix=/^\s*(?:from\s+SphexPay\s*(?:\r?\n|[-–—:]\s*)?|enviado\s+por\s+SphexPay\s*(?:\r?\n)?)/i

export function sanitizeNotificationBody(value:unknown){
 if(typeof value!=='string')return''
 return value.replace(brandedPrefix,'').trim()
}
