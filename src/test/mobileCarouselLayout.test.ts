import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe,expect,it } from 'vitest'

const css=readFileSync(resolve(process.cwd(),'src/index.css'),'utf8')
const carousel=readFileSync(resolve(process.cwd(),'src/components/dashboard/OverviewHeroCarousel.tsx'),'utf8')

describe('layout mobile do carrossel e da competição',()=>{
 const finalMobile=css.slice(css.indexOf('/* Mobile gateway hero — final cascade layer; desktop and tablet stay untouched. */'))
 it('aplica a composição final somente no mobile com proporção responsiva 16:9',()=>{
  expect(finalMobile).toContain('@media(max-width:767px){')
  expect(finalMobile).toContain('aspect-ratio:16/9')
  expect(finalMobile).toContain('height:clamp(250px,56.25vw,278px)')
  expect(finalMobile).not.toContain('@media(min-width:768px)')
 })
 it('mantém conteúdo, arte e controles inteiros dentro do banner',()=>{
  expect(finalMobile).toContain('grid-template-columns:minmax(0,1fr)')
  expect(finalMobile).toContain('object-fit:contain')
  expect(finalMobile).toContain('max-height:174px')
  expect(finalMobile).toContain('.overview-controls')
  expect(finalMobile).toContain('width:44px')
  expect(finalMobile).toContain('min-height:44px')
  expect(finalMobile).toContain('pointer-events:auto')
 })
 it('afina o topo autenticado sem reduzir as áreas de toque',()=>{
  expect(finalMobile).toContain('height:calc(52px + var(--safe-top))')
  expect(finalMobile).toContain('padding:var(--safe-top) max(8px,var(--safe-right))')
  expect(finalMobile).toContain('min-width:44px')
  expect(finalMobile).toContain('min-height:44px')
 })
 it('mantém as correções estruturais limitadas ao breakpoint mobile',()=>{
  const marker=css.indexOf('/* Mobile headers: compact composition without changing tablet or desktop. */')
  const mobile=css.slice(marker,css.indexOf('/* Dashboard production:',marker))
  expect(mobile).toContain('@media(max-width:767px){')
  expect(mobile).toContain('.overview-slide{')
  expect(mobile).toContain('height:390px')
  expect(mobile).not.toContain('@media(min-width:768px)')
 })
 it('enquadra as artes completas em uma composição compacta no mobile',()=>{
  const marker=css.indexOf('/* Mobile headers: compact composition without changing tablet or desktop. */')
  const mobile=css.slice(marker,css.indexOf('/* Dashboard production:',marker))
  expect(mobile).toContain('.gateway-art,.iphone-art,.overview-slide.competition .iphone-art')
  expect(mobile).toContain('position:absolute')
  expect(mobile).toContain('object-fit:contain;object-position:center')
  expect(mobile).toContain('.competition-hero-product img{width:96px;max-width:100%;height:154px')
 })
 it('organiza controles acessíveis em uma faixa própria e oferece swipe',()=>{
  expect(css).toContain('.overview-controls>button{width:44px;height:44px')
  expect(carousel).toContain('aria-label="Banner anterior"')
  expect(carousel).toContain('aria-label="Próximo banner"')
  expect(carousel).toContain('onTouchStart=')
  expect(carousel).toContain('onTouchEnd=')
 })
 it('adapta o contador em quatro e duas colunas sem overflow',()=>{
  expect(css).toContain('.competition-countdown{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))')
  expect(css).toContain('.competition-countdown{grid-template-columns:repeat(2,minmax(0,1fr))')
  expect(css).toContain('.competition-hero-actions .btn{width:100%;min-height:48px')
 })
 it('oculta apenas a aparência das barras e preserva containers roláveis',()=>{
  expect(css).toContain('scrollbar-width:none')
  expect(css).toContain('::-webkit-scrollbar')
  expect(css).not.toContain('body{overflow:hidden')
 })
 it('desativa animações do carrossel quando o movimento é reduzido',()=>{
  expect(css).toContain('@media(prefers-reduced-motion:reduce)')
  expect(css).toContain('.overview-track{transition:none}')
 })
})
