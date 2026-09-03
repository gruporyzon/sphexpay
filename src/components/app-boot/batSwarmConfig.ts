export const BAT_QUALITY_COUNTS={low:32,medium:52,high:72} as const
export const BAT_SCENE_DURATION=3300
export type BatQuality=keyof typeof BAT_QUALITY_COUNTS

export const BAT_WING_FRAME_PATHS=[
 'M0-3 C-2-7-5-8-8-6 L-12-10-18-9-24-4 L-31-8-39-6-45-1 L-37 1-42 7-32 6-27 13-18 8-13 15-6 7-3 13 0 18 3 13 6 7 13 15 18 8 27 13 32 6 42 7 37 1 45-1 39-6 31-8 24-4 18-9 12-10 8-6 5-8 2-7 0-3 Z M-3-5 C-3-9-1-11 0-11 1-11 3-9 3-5 Z',
 'M0-3 C-2-7-5-7-8-4 L-13-7-19-5-24 0 L-31-3-38 0-41 6 L-33 5-34 12-26 8-21 15-14 9-10 16-5 8-3 13 0 18 3 13 5 8 10 16 14 9 21 15 26 8 34 12 33 5 41 6 38 0 31-3 24 0 19-5 13-7 8-4 5-7 2-7 0-3 Z M-3-5 C-3-9-1-11 0-11 1-11 3-9 3-5 Z',
 'M0-3 C-2-7-4-6-7-2 L-11-3-15 1-17 7 L-23 6-27 12-25 18 L-19 14-18 22-12 16-9 23-5 13-3 15 0 19 3 15 5 13 9 23 12 16 18 22 19 14 25 18 27 12 23 6 17 7 15 1 11-3 7-2 4-6 2-7 0-3 Z M-3-5 C-3-9-1-11 0-11 1-11 3-9 3-5 Z'
] as const

export function getBatWingFrame(phase:number){const cycle=Math.floor(phase)%4;return cycle===3?1:cycle}

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
