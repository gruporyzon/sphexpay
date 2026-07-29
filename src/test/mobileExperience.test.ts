import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe,expect,it } from 'vitest'

const read=(path:string)=>readFileSync(resolve(process.cwd(),path),'utf8')
const html=read('index.html')
const globalCss=read('src/index.css')
const publicCss=read('src/public.css')
const soundProvider=read('src/providers/SoundProvider.tsx')
const landing=read('src/pages/public/LandingPage.tsx')
const manifest=JSON.parse(read('public/manifest.webmanifest')) as {
 display:string
 background_color:string
 icons:Array<{purpose?:string}>
 shortcuts:Array<{url:string}>
}

describe('experiência mobile',()=>{
 it('habilita viewport-fit e define safe areas globais',()=>{
  expect(html).toMatch(/viewport-fit=cover/)
  expect(globalCss).toContain('--safe-top:env(safe-area-inset-top,0px)')
  expect(globalCss).toContain('--safe-bottom:env(safe-area-inset-bottom,0px)')
 })

 it('protege os cabeçalhos público e autenticado nas safe areas',()=>{
  expect(publicCss).toMatch(/\.public-header\{[\s\S]*padding-top:max\(10px,var\(--safe-top\)\)/)
  expect(globalCss).toMatch(/\.app-header\{[\s\S]*padding-top:max\(8px,var\(--safe-top\)\)/)
  expect(globalCss).toContain('padding-bottom:max(24px,var(--safe-bottom))')
 })

 it('não renderiza o modal sonoro e preserva o desbloqueio por gesto',()=>{
  expect(soundProvider).not.toContain('sound-unlock')
  expect(soundProvider).not.toContain('sphexpay_sound_prompt_dismissed')
  expect(soundProvider).toContain("addEventListener('pointerdown',resumeFromGesture")
  expect(soundProvider).toContain('audioManager.ensureAudioReady(true)')
 })

 it('remove o aviso demonstrativo específico sem afirmar operação real',()=>{
  expect(landing).not.toContain('Ambiente atual demonstrativo.')
 })

 it('reserva área própria e mantém a plaquinha contida no mobile',()=>{
  expect(globalCss).toMatch(/\.next-award-plaque\{grid-row:auto;width:100%;height:112px/)
  expect(globalCss).toContain('.next-award-plaque .official-award-plaque img{width:100%;height:100%;object-fit:contain}')
 })

 it('mantém filtros, botões e cards responsivos entre 320 e 430 pixels',()=>{
  expect(globalCss).toContain('@media(max-width:359px)')
  expect(globalCss).toContain('@media(min-width:390px) and (max-width:767px)')
  expect(globalCss).toContain('min-height:44px')
  expect(globalCss).toContain('.dashboard-filter-bar{display:grid')
  expect(globalCss).toContain('.dashboard-metrics{grid-template-columns:1fr')
 })

 it('mantém PWA standalone e atalhos autenticados corretos',()=>{
  expect(manifest.display).toBe('standalone')
  expect(manifest.background_color).toBe('#090909')
  expect(manifest.icons.some(icon=>icon.purpose?.includes('maskable'))).toBe(true)
  expect(manifest.shortcuts.map(item=>item.url)).toEqual(['/app','/app/vendas'])
 })

 it('respeita redução de movimento e evita overflow horizontal global',()=>{
  expect(globalCss).toContain('@media(prefers-reduced-motion:reduce)')
  expect(publicCss).toContain('@media(prefers-reduced-motion:reduce)')
  expect(globalCss).toContain('overflow-x:clip')
 })

 it('mantém o mapa global responsivo e reduz animações no mobile',()=>{
  expect(globalCss).toContain('.live-world-page{width:100%;max-width:100%;min-width:0;overflow-x:clip')
  expect(globalCss).toContain('.live-world-layout{grid-template-columns:1fr}')
  expect(globalCss).toContain('.live-world-kpis{grid-template-columns:repeat(2,minmax(0,1fr))')
  expect(globalCss).toContain('.live-world-routes path,.live-world-origin .wave,.live-world-points .wave')
 })

 it('refina somente no mobile o topo e os banners principais',()=>{
  const marker=globalCss.indexOf('/* Mobile headers: compact composition without changing tablet or desktop. */')
  const mobile=globalCss.slice(marker,globalCss.indexOf('/* Dashboard production:',marker))
  expect(marker).toBeGreaterThan(0)
  expect(mobile).toMatch(/^\/\*[\s\S]*@media\(max-width:767px\)/)
  expect(mobile).toContain('height:calc(52px + var(--safe-top))')
  expect(mobile).toContain('.app-header .header-brand{display:inline-flex')
  expect(mobile).toContain('.overview-carousel{height:390px;min-height:390px')
  expect(mobile).toContain('object-fit:contain;object-position:center')
  expect(mobile).toContain('.competition-hero-product{')
  expect(mobile).toContain('position:absolute')
  expect(mobile).not.toContain('@media(min-width:768px)')
 })
})
