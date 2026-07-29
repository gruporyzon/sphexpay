import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe,expect,it } from 'vitest'

const css=readFileSync(resolve(process.cwd(),'src/index.css'),'utf8')
const carousel=readFileSync(resolve(process.cwd(),'src/components/dashboard/OverviewHeroCarousel.tsx'),'utf8')

describe('layout mobile do carrossel e da competição',()=>{
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
