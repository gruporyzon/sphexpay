import { cn } from '../../lib/utils'
import { useDemoStore } from '../../store/useDemoStore'

type SphexPayLogoProps={className?:string;showName?:boolean;showWordmark?:boolean;priority?:boolean;shortName?:boolean;size?:number|string;alt?:string}

export function SphexPayLogo({className,showName=false,showWordmark=false,priority=false,size=96,alt='Sphex'}:SphexPayLogoProps){
 const wordmark=showName||showWordmark
 const theme=useDemoStore(state=>state.theme)
 const source=theme==='dark'?'/brand/sphex-symbol-white.png':'/brand/sphex-symbol-black.png'
 const intrinsicWidth=Number(size)||96
 return <span className={cn('sphexpay-brand',className)} aria-label="Sphex"><img src={source} alt={wordmark?'':alt} width={size} height={Math.round(intrinsicWidth*744/1717)} draggable="false" loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'}/>{wordmark&&<span className="sphexpay-wordmark">Sphex</span>}</span>
}
