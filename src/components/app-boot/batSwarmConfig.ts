export const BAT_QUALITY_COUNTS={low:48,medium:76,high:108} as const
export type BatQuality=keyof typeof BAT_QUALITY_COUNTS

export function getBatQuality({width,dpr,cores}:{width:number;dpr:number;cores:number}):BatQuality{
 if(width<350||cores<=4||dpr>3)return'low'
 if(width<900||cores<=8||dpr>2.25)return'medium'
 return'high'
}

export function sampleTargetPixels(pixels:Uint8ClampedArray,width:number,height:number,count:number,random:()=>number=Math.random){
 const candidates:Array<[number,number]>=[]
 for(let y=6;y<height-6;y+=3)for(let x=6;x<width-6;x+=3)if(pixels[(y*width+x)*4+3]>72)candidates.push([(x-width/2)/(width-26),(y-height/2)/(height-28)])
 const points:Array<[number,number]>=[],minimumDistanceSquared=.0022
 while(candidates.length&&points.length<count){const index=Math.floor(random()*candidates.length),candidate=candidates.splice(index,1)[0];if(points.every(point=>(point[0]-candidate[0])**2+(point[1]-candidate[1])**2>minimumDistanceSquared))points.push(candidate)}
 for(let index=0;points.length<count&&index<candidates.length;index++)points.push(candidates[index])
 return points
}
