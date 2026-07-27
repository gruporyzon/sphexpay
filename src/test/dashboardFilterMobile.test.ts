import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe,expect,it } from 'vitest'

const css=readFileSync(resolve(process.cwd(),'src/index.css'),'utf8')
const controls=readFileSync(resolve(process.cwd(),'src/components/dashboard/DashboardControls.tsx'),'utf8')

describe('filtros do Dashboard no mobile',()=>{
 it('corrige a altura explícita que cortava os selects nativos',()=>{
  expect(css).toContain('height:60px;')
  expect(css).toContain('min-height:60px;')
  expect(css).toContain('line-height:1.3;')
  expect(css).toContain('font-size:16px;')
 })
 it('mantém o texto em uma linha e reserva espaço para a seta',()=>{
  expect(css).toContain('padding:0 42px 0 14px;')
  expect(css).toContain('white-space:nowrap;')
  expect(css).toContain('text-overflow:ellipsis;')
  expect(css).toContain('-webkit-appearance:auto;')
 })
 it('mantém os selects reais, labels acessíveis e moedas completas',()=>{
  expect(controls).toContain('aria-label="Período do gráfico"')
  expect(controls).toContain('aria-label="Moeda de exibição"')
  expect(controls).toContain('USD — Dólar americano')
  expect(controls).toContain('BRL — Real brasileiro')
  expect(controls).toContain('EUR — Euro')
 })
 it('limita a alteração ao breakpoint mobile',()=>{
  const block=css.slice(css.lastIndexOf('/* Native dashboard selects'))
  expect(block).toContain('@media(max-width:767px)')
  expect(block).not.toContain('@media(min-width')
 })
})
