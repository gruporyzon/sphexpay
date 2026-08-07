import type { KeyboardEvent } from 'react'

type SegmentedControlProps<T extends string>={ariaLabel:string;items:readonly T[];value:T;onChange:(value:T)=>void;className?:string}

export function SegmentedControl<T extends string>({ariaLabel,items,value,onChange,className=''}:SegmentedControlProps<T>){
 const onKeyDown=(event:KeyboardEvent<HTMLButtonElement>,index:number)=>{
  const offsets:Record<string,number>={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}
  if(event.key in offsets){event.preventDefault();onChange(items[(index+offsets[event.key]+items.length)%items.length])}
  if(event.key==='Home'){event.preventDefault();onChange(items[0])}
  if(event.key==='End'){event.preventDefault();onChange(items[items.length-1])}
 }
 return <div className={`internal-segmented-control ${className}`.trim()} role="tablist" aria-label={ariaLabel}>{items.map((item,index)=><button type="button" role="tab" aria-selected={value===item} tabIndex={value===item?0:-1} className={`internal-segmented-item ${value===item?'active':''}`} key={item} onClick={()=>onChange(item)} onKeyDown={event=>onKeyDown(event,index)}>{item}</button>)}</div>
}
