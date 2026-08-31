import { cn } from '../../lib/utils'

type SphexPayLogoProps={className?:string;showName?:boolean;showWordmark?:boolean;priority?:boolean;shortName?:boolean;size?:number|string;alt?:string}

export function SphexPayLogo({className,showName=false,showWordmark=false,priority=false,size=96,alt='Sphex'}:SphexPayLogoProps){
 const wordmark=showName||showWordmark
 return <span className={cn('sphexpay-brand',className)} aria-label="Sphex"><img src="/brand/LOGO.PNG" alt={wordmark?'':alt} width={size} height={size} draggable="false" loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} onError={event=>{event.currentTarget.hidden=true}}/>{wordmark&&<span className="sphexpay-wordmark">Sphex</span>}</span>
}
