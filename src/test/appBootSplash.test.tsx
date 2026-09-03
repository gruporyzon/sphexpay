import { act,render,screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
import { APP_BOOT_SESSION_KEY,APP_BOOT_TIMING,AppBootSplash } from '../components/app-boot/AppBootSplash'
import { BatSwarmScene } from '../components/app-boot/BatSwarmScene'
import { BAT_QUALITY_COUNTS,getBatQuality } from '../components/app-boot/batSwarmConfig'

describe('abertura premium do app',()=>{
 beforeEach(()=>{sessionStorage.clear();vi.useFakeTimers();vi.mocked(window.matchMedia).mockImplementation(query=>({matches:false,media:query,onchange:null,addListener:vi.fn(),removeListener:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn(),dispatchEvent:vi.fn()}))})
 afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks()})

 it('mantem a interface montada e remove a splash no limite de seguranca',()=>{
  render(<AppBootSplash appReady={false}><main>Interface real</main></AppBootSplash>)
  expect(screen.getByText('Interface real')).toBeInTheDocument()
  expect(screen.getByRole('status',{name:'Abrindo SphexPay'})).toBeInTheDocument()
  expect(screen.getByText('Interface real').parentElement).toHaveAttribute('inert')
  act(()=>vi.advanceTimersByTime(APP_BOOT_TIMING.desktop.max+20))
  expect(screen.getByRole('status',{name:'Abrindo SphexPay'})).toHaveClass('leaving')
  act(()=>vi.advanceTimersByTime(APP_BOOT_TIMING.desktop.exit+20))
  expect(screen.queryByRole('status',{name:'Abrindo SphexPay'})).not.toBeInTheDocument()
  expect(screen.getByText('Interface real').parentElement).not.toHaveAttribute('inert')
 })

 it('registra a execucao na sessao e nao repete no mesmo boot',()=>{
  const first=render(<AppBootSplash appReady><main>Primeiro</main></AppBootSplash>)
  expect(sessionStorage.getItem(APP_BOOT_SESSION_KEY)).toBe('true')
  first.unmount()
  render(<AppBootSplash appReady><main>Segundo</main></AppBootSplash>)
  expect(screen.queryByRole('status',{name:'Abrindo SphexPay'})).not.toBeInTheDocument()
  expect(screen.getByText('Segundo')).toBeVisible()
 })

 it('define tempos curtos e um modo de movimento reduzido',()=>{
  expect(APP_BOOT_TIMING.mobile).toEqual({min:2050,max:2300,exit:300})
  expect(APP_BOOT_TIMING.mobile.max+APP_BOOT_TIMING.mobile.exit).toBeLessThanOrEqual(2600)
  expect(APP_BOOT_TIMING.desktop.max).toBeLessThan(APP_BOOT_TIMING.mobile.max)
  expect(APP_BOOT_TIMING.reduced.max).toBeLessThan(APP_BOOT_TIMING.desktop.max)
 })

 it('renderiza a revoada em um unico canvas com densidade adaptativa',()=>{
  render(<AppBootSplash appReady><main>Interface real</main></AppBootSplash>)
  expect(document.querySelectorAll('canvas.app-boot-swarm')).toHaveLength(1)
  expect(BAT_QUALITY_COUNTS).toEqual({low:48,medium:76,high:108})
  expect(getBatQuality({width:320,dpr:3,cores:4})).toBe('low')
  expect(getBatQuality({width:390,dpr:2,cores:8})).toBe('medium')
  expect(getBatQuality({width:1440,dpr:2,cores:12})).toBe('high')
 })

 it('desativa a cena intensa quando o usuario prefere movimento reduzido',()=>{
  vi.mocked(window.matchMedia).mockImplementation(query=>({matches:query.includes('prefers-reduced-motion'),media:query,onchange:null,addListener:vi.fn(),removeListener:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn(),dispatchEvent:vi.fn()}))
  const raf=vi.spyOn(window,'requestAnimationFrame')
  render(<AppBootSplash appReady><main>Interface real</main></AppBootSplash>)
  expect(document.querySelector('.app-boot-logo')).toBeInTheDocument()
  expect(raf).toHaveBeenCalledTimes(1)
  act(()=>vi.advanceTimersByTime(APP_BOOT_TIMING.reduced.max+20))
  act(()=>vi.advanceTimersByTime(APP_BOOT_TIMING.reduced.exit+20))
  expect(screen.queryByRole('status',{name:'Abrindo SphexPay'})).not.toBeInTheDocument()
 })

 it('limpa frame e resize ao desmontar o canvas',()=>{
  const context={setTransform:vi.fn(),clearRect:vi.fn(),save:vi.fn(),restore:vi.fn(),translate:vi.fn(),rotate:vi.fn(),scale:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),bezierCurveTo:vi.fn(),lineTo:vi.fn(),quadraticCurveTo:vi.fn(),closePath:vi.fn(),fill:vi.fn(),globalAlpha:1,fillStyle:''}
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as never)
  const remove=vi.spyOn(window,'removeEventListener'),cancel=vi.spyOn(window,'cancelAnimationFrame')
  const view=render(<BatSwarmScene/>);act(()=>window.dispatchEvent(new Event('resize')));view.unmount()
  expect(context.setTransform).toHaveBeenCalled()
  expect(remove).toHaveBeenCalledWith('resize',expect.any(Function))
  expect(cancel).toHaveBeenCalled()
  expect(context.clearRect).toHaveBeenCalled()
 })

 it('mantem fallback e timeout mesmo quando canvas falha',async()=>{
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null)
  render(<AppBootSplash appReady={false}><main>Interface preservada</main></AppBootSplash>)
  await act(async()=>{await Promise.resolve()})
  expect(document.querySelector('.scene-fallback')).toBeInTheDocument()
  act(()=>vi.advanceTimersByTime(APP_BOOT_TIMING.desktop.max+20))
  act(()=>vi.advanceTimersByTime(APP_BOOT_TIMING.desktop.exit+20))
  expect(screen.queryByRole('status',{name:'Abrindo SphexPay'})).not.toBeInTheDocument()
  expect(screen.getByText('Interface preservada')).toBeVisible()
 })

 it('cobre viewport dinamico, safe area, movimento reduzido e fundo pre-React',()=>{
  const css=readFileSync(resolve(process.cwd(),'src/components/app-boot/app-boot-splash.css'),'utf8')
  const html=readFileSync(resolve(process.cwd(),'index.html'),'utf8')
  expect(css).toContain('height:100dvh')
  expect(css).toContain('env(safe-area-inset-bottom)')
  expect(css).toContain('@media(orientation:landscape)')
  expect(css).toContain('@media(prefers-reduced-motion:reduce)')
  expect(css).toContain('.app-boot-swarm')
  expect(html).toContain('class="app-boot-pending"')
  expect(html).toContain('background:#050505!important')
 })
})
