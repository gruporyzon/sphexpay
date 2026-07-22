import { cn } from '../../lib/utils'

type SphexPayLogoProps={className?:string;showName?:boolean;priority?:boolean}

export function SphexPayLogo({className,showName=false,priority=false}:SphexPayLogoProps){
 return <span className={cn('sphexpay-brand',className)} aria-label="SphexPay"><img src="/branding/sphexpay-logo-96.png" alt="" width="96" height="96" draggable="false" loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'}/>{showName&&<span className="sphexpay-wordmark">Sphex<span>Pay</span></span>}</span>
}
