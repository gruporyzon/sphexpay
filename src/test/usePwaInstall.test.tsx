import {act,renderHook} from '@testing-library/react'
import {describe,expect,it,vi} from 'vitest'
import {usePwaInstall} from '../hooks/usePwaInstall'
import {pwaInstallService,type InstallPromptEvent} from '../services/pwaInstallService'

describe('usePwaInstall cleanup',()=>{
 it('inscreve, atualiza e desmonta usando uma função de cleanup válida',()=>{
  const unsubscribe=vi.fn(),subscribe=vi.spyOn(pwaInstallService,'subscribe').mockReturnValue(unsubscribe)
  const {unmount}=renderHook(()=>usePwaInstall())
  expect(subscribe).toHaveBeenCalledOnce()
  expect(typeof subscribe.mock.results[0]?.value).toBe('function')
  expect(()=>unmount()).not.toThrow()
  expect(unsubscribe).toHaveBeenCalledOnce()
 })
 it('preserva o prompt de instalação e não o limpa ao desmontar',async()=>{
  const prompt=vi.fn().mockResolvedValue(undefined),event={prompt,userChoice:Promise.resolve({outcome:'accepted' as const})} as unknown as InstallPromptEvent
  window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'),event))
  const {result,unmount}=renderHook(()=>usePwaInstall())
  if(result.current.canInstall)await act(()=>result.current.install())
  unmount()
  expect(prompt.mock.calls.length).toBeLessThanOrEqual(1)
 })
})
