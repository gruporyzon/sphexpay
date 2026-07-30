import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe,expect,it } from 'vitest'

const css=readFileSync(resolve(process.cwd(),'src/index.css'),'utf8')
const controls=readFileSync(resolve(process.cwd(),'src/components/dashboard/DashboardControls.tsx'),'utf8')
const realtime=readFileSync(resolve(process.cwd(),'src/components/dashboard/RealtimeStatus.tsx'),'utf8')

describe('filtros do Dashboard no mobile',()=>{
 it('usa selects nativos compactos sem cortar texto',()=>{
  expect(css).toContain('height:50px;')
  expect(css).toContain('min-height:50px;')
  expect(css).toContain('line-height:1.3;')
  expect(css).toContain('font-size:16px;')
 })
 it('organiza período e moeda em duas colunas e recolhe para uma coluna em 320px',()=>{
  expect(css).toContain('grid-template-columns:minmax(112px,.8fr) minmax(0,1.2fr)')
  expect(css).toContain('@media(max-width:359px)')
  expect(css).toContain('.dashboard-page .dashboard-filter-bar{grid-template-columns:minmax(0,1fr);gap:12px}')
  expect(css).toContain('.dashboard-page .dashboard-realtime{grid-column:1/-1')
 })
 it('compacta labels, ícones, status e botão sem reduzir áreas de toque',()=>{
  expect(css).toContain('grid-template-columns:20px minmax(0,1fr)')
  expect(css).toContain('width:20px;height:20px')
  expect(css).toContain('width:44px;height:44px')
  expect(realtime).toContain('aria-label="Atualizar vendas"')
  expect(realtime).toContain('Atualização ao vivo')
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
  const start=css.indexOf('/* Native dashboard selects'),end=css.indexOf('/* Mobile podium',start),block=css.slice(start,end)
  expect(block).toContain('@media(max-width:767px)')
  expect(block).toContain('.dashboard-page .dashboard-filter-bar')
  expect(block).not.toContain('@media(min-width')
 })
 it('preserva as regras compartilhadas e o desktop',()=>{
  expect(css).toContain('.dashboard-filter-bar{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;padding:16px}')
  expect(css).toContain('height:60px;')
  expect(css.indexOf('.dashboard-page .dashboard-filter-bar{display:grid;grid-template-columns:minmax(112px')).toBeGreaterThan(css.indexOf('@media(max-width:767px)'))
 })
})
