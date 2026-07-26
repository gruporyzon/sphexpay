import { act,renderHook,waitFor } from '@testing-library/react'
import { afterEach,describe,expect,it,vi } from 'vitest'
import type { CompetitionStanding } from '../services/competitionEngine'

const mocks=vi.hoisted(()=>({load:vi.fn(),subscribe:vi.fn(),disconnect:vi.fn()}))
vi.mock('../services/competitionService',()=>({competitionService:mocks}))
import { useCompetition } from '../hooks/useCompetition'

const row:CompetitionStanding={userId:'user-1',publicName:'Ronald R.',eligibleRevenueCents:1_500_000,eligibleSalesCount:5,auditStatus:'eligible'}

describe('useCompetition Realtime',()=>{
 afterEach(()=>vi.clearAllMocks())
 it('carrega ranking real, identifica o usuário e revalida após evento',async()=>{
  mocks.load.mockResolvedValue({standings:[row],updatedAt:'2026-09-10T12:00:00-03:00',source:'supabase'})
  let change:()=>void=()=>undefined
  mocks.subscribe.mockImplementation((callback:()=>void)=>{change=callback;return{id:'channel'}})
  const {result,unmount}=renderHook(()=>useCompetition('user-1'))
  await waitFor(()=>expect(result.current.loading).toBe(false))
  expect(result.current.position).toBe(1)
  expect(result.current.realtime).toBe('live')
  await act(async()=>{change();await Promise.resolve()})
  expect(mocks.load).toHaveBeenCalledTimes(2)
  unmount()
  expect(mocks.disconnect).toHaveBeenCalled()
 })
})
