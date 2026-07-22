import { AlertCircle,CheckCircle2 } from 'lucide-react'
export function AuthNotice({message,success=false}:{message:string;success?:boolean}){if(!message)return null;return <div className={success?'auth-notice success':'auth-notice'} role={success?'status':'alert'}>{success?<CheckCircle2/>:<AlertCircle/>}<span>{message}</span></div>}
