import { useSyncExternalStore } from 'react'
import { audioManager } from '../services/audioManager'

export function useSound(){
 const state=useSyncExternalStore(audioManager.subscribe,audioManager.getSnapshot,audioManager.getSnapshot)
 return {...state,activate:()=>audioManager.activate(),disable:()=>audioManager.disable(),ensureReady:(gesture=true)=>audioManager.ensureAudioReady(gesture),testSound:()=>audioManager.test('sale'),diagnostics:()=>audioManager.diagnostics()}
}
