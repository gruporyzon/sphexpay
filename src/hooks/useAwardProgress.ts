import { useMemo } from 'react'
import type { Achievement } from '../types'

export function useAwardProgress(revenue:number,achievements:Achievement[]){return useMemo(()=>{const next=achievements.find(item=>revenue<item.target)??achievements.at(-1);const complete=next?revenue>=next.target:false;const progress=next?Math.min(100,revenue/next.target*100):100;return{next,complete,progress,current:revenue,remaining:next?Math.max(0,next.target-revenue):0}},[achievements,revenue])}
