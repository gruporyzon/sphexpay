import { audioManager } from './audioManager'
import type { SphexSound } from './audioManager'

export const audioService={
 playSale(volume=.35,style:'signal'|'pulse'|'soft'='signal',key:string='sale'){
  const adjusted=style==='soft'?volume*.7:style==='pulse'?volume*.88:volume
  return audioManager.play('sale',adjusted,key,2)
 },
 playNotification(kind:Exclude<SphexSound,'sale'>='alert',volume=.35,key:string=kind){
  return audioManager.play(kind,volume,key,kind==='achievement'?3:1)
 },
 vibrate(){return audioManager.vibrate()},
 dispose(){audioManager.dispose()}
}
