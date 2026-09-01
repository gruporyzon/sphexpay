import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe,expect,it } from 'vitest'

const read=(path:string)=>readFileSync(resolve(process.cwd(),path),'utf8')
const hook=read('src/hooks/useLandingMotion.ts')
const css=read('src/public.css')

describe('efeitos da entrada publica',()=>{
 it('conecta o estado produzido pelo hook aos seletores de movimento',()=>{
  expect(hook).toContain("const motionSelector='[data-motion]'")
  expect(hook).toContain("element.dataset.motionState='pending'")
  expect(hook).toContain("element.dataset.motionState='visible'")
  expect(css).toContain('[data-motion][data-motion-state="pending"]')
  expect(css).toContain('[data-motion][data-motion-state="visible"]')
 })

 it('preserva fallback visivel e revela a hero depois de um frame pintado',()=>{
  expect(css).toContain('.landing-redesign [data-motion]{--motion-delay:0ms;opacity:1}')
  expect(hook).toMatch(/requestAnimationFrame\(\(\)=>\{\s*revealFrame=requestAnimationFrame/)
  expect(hook).toContain('observer.unobserve(element)')
 })

 it('usa parallax leve em pixels e desativa o custo no mobile',()=>{
  expect(hook).toContain("'(min-width: 901px) and (hover: hover)'")
  expect(hook).toContain("--hero-scroll-y")
  expect(hook).toContain("--hero-pointer-x")
  expect(css).toContain('translate3d(var(--hero-pointer-x),calc(var(--hero-pointer-y) + var(--hero-scroll-y)),0)')
  expect(css).toContain('@media(max-width:900px)')
 })

 it('mantem todo o conteudo visivel com movimento reduzido',()=>{
  const motionLayer=css.slice(css.indexOf('/* Motion system da entrada publica'))
  expect(motionLayer).toContain('@media(prefers-reduced-motion:reduce)')
  expect(motionLayer).toContain('opacity:1!important;translate:none!important;scale:none!important;transition:none!important')
  expect(motionLayer).toContain('animation:none!important')
 })
})
