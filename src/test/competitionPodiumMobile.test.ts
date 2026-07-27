import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe,expect,it } from 'vitest'

const css=readFileSync(resolve(process.cwd(),'src/index.css'),'utf8')
const podium=readFileSync(resolve(process.cwd(),'src/components/competition/CompetitionLeaderboard.tsx'),'utf8')

describe('pódio da competição no mobile',()=>{
 it('usa o componente real e mantém os três lugares na ordem correta',()=>{
  expect(podium).toContain('CompetitionPodium')
  expect(podium).toContain('podium-${position}')
  expect(podium).toContain('<i>{position}</i>')
 })
 it('destaca o primeiro lugar e alinha segundo e terceiro abaixo',()=>{
  const block=css.slice(css.lastIndexOf('/* Mobile podium'))
  expect(block).toContain('grid-template-columns:repeat(2,minmax(0,1fr))')
  expect(block).toContain('.competition-podium .podium-1{')
  expect(block).toContain('grid-column:1/-1')
 })
 it('impede expansão lateral e corte do terceiro card',()=>{
  const block=css.slice(css.lastIndexOf('/* Mobile podium'))
  expect(block).toContain('min-width:0')
  expect(block).toContain('width:100%')
  expect(block).toContain('overflow-wrap:anywhere')
  expect(block).toContain('@media(max-width:359px)')
  expect(block).toContain('grid-template-columns:minmax(0,1fr)')
 })
 it('mantém números decorativos atrás do conteúdo',()=>{
  const block=css.slice(css.lastIndexOf('/* Mobile podium'))
  expect(block).toContain('z-index:0;font-size:50px')
  expect(block).toContain('.competition-podium .podium-crown{z-index:2')
 })
 it('não altera o grid desktop',()=>{
  expect(css).toContain('.competition-podium{display:grid;grid-template-columns:repeat(3,1fr)')
 })
})
