export const MOBILE_DOCK_DEFAULT_OPACITY=72

export function normalizeMobileDockOpacity(value:unknown){
 const parsed=typeof value==='number'?value:typeof value==='string'&&value.trim()!==''?Number(value):Number.NaN
 return Number.isFinite(parsed)?Math.min(100,Math.max(0,Math.round(parsed))):MOBILE_DOCK_DEFAULT_OPACITY
}

const lerp=(min:number,max:number,t:number)=>min+(max-min)*t
const fixed=(value:number)=>Number(value.toFixed(3))

export function getMobileDockVisualSettings(value:unknown){
 const opacity=normalizeMobileDockOpacity(value),t=opacity/100
 return {
  opacity,
  backgroundAlpha:fixed(lerp(.46,.96,t)),
  blur:fixed(lerp(20,8,t)),
  shadowAlpha:fixed(lerp(.22,.34,t)),
  borderAlpha:fixed(lerp(.045,.075,t)),
 }
}

export function mobileDockVisualStyle(value:unknown){
 const visual=getMobileDockVisualSettings(value)
 return {
  '--mobile-dock-opacity-setting':`${visual.opacity}`,
  '--mobile-dock-bg-alpha':`${visual.backgroundAlpha}`,
  '--mobile-dock-blur':`${visual.blur}px`,
  '--mobile-dock-shadow-alpha':`${visual.shadowAlpha}`,
  '--mobile-dock-border-alpha':`${visual.borderAlpha}`,
 }
}
