export const BAT_QUALITY_COUNTS={low:48,medium:76,high:108} as const
export type BatQuality=keyof typeof BAT_QUALITY_COUNTS

export function getBatQuality({width,dpr,cores}:{width:number;dpr:number;cores:number}):BatQuality{
 if(width<350||cores<=4||dpr>3)return'low'
 if(width<900||cores<=8||dpr>2.25)return'medium'
 return'high'
}
