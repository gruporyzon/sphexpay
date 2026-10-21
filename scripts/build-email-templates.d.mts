import type { EmailContent } from '../supabase/functions/_shared/emailLayout'
export declare const authTemplates: Record<'confirmation'|'recovery'|'magic_link'|'email_change'|'invite'|'reauthentication',{subject:string;content:EmailContent}>
