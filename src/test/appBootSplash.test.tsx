import { act,render,screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
import { APP_BOOT_SESSION_KEY,APP_BOOT_TIMING,AppBootSplash } from '../components/app-boot/AppBootSplash'

describe('abertura premium do app',()=>{
 beforeEach(()=>{sessionStorage.clear();vi.useFakeTimers()})
 afterEach(()=>vi.useRealTimers())

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
  expect(APP_BOOT_TIMING.mobile).toEqual({min:720,max:1800,exit:360})
  expect(APP_BOOT_TIMING.desktop.max).toBeLessThan(APP_BOOT_TIMING.mobile.max)
  expect(APP_BOOT_TIMING.reduced.max).toBeLessThan(APP_BOOT_TIMING.desktop.max)
 })

 it('cobre viewport dinamico, safe area, movimento reduzido e fundo pre-React',()=>{
  const css=readFileSync(resolve(process.cwd(),'src/components/app-boot/app-boot-splash.css'),'utf8')
  const html=readFileSync(resolve(process.cwd(),'index.html'),'utf8')
  expect(css).toContain('height:100dvh')
  expect(css).toContain('env(safe-area-inset-bottom)')
  expect(css).toContain('@media(orientation:landscape)')
  expect(css).toContain('@media(prefers-reduced-motion:reduce)')
  expect(html).toContain('class="app-boot-pending"')
  expect(html).toContain('background:#050505!important')
 })
})
