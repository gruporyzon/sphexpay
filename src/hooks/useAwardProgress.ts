import { useMemo } from 'react'
import type { Achievement } from '../types'
import { nextAwardProgress } from '../services/awardProgressService'

export function useAwardProgress(revenue:number,achievements:Achievement[]){return useMemo(()=>nextAwardProgress(revenue,achievements),[achievements,revenue])}
