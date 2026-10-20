import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { SearchInput } from '../components/common/SearchInput'

function setup(){return render(<MemoryRouter initialEntries={['/app']}><Routes><Route path="/app" element={<SearchInput/>}/><Route path="/app/integracoes" element={<h1>Integrações abertas</h1>}/><Route path="/app/produtos" element={<h1>Produtos abertos</h1>}/></Routes></MemoryRouter>)}
describe('busca do workspace',()=>{
 it('encontra um módulo sem exigir acentos e abre o destino por Enter',async()=>{
  const user=userEvent.setup();setup()
  await user.type(screen.getByRole('searchbox',{name:'Buscar módulos'}),'integracoes')
  expect(screen.getByRole('button',{name:'Abrir Integrações'})).toBeVisible()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('heading',{name:'Integrações abertas'})).toBeVisible()
 })
 it('abre por atalho, informa busca vazia e fecha por Escape',async()=>{
  const user=userEvent.setup();setup()
  await user.keyboard('{Control>}k{/Control}')
  expect(screen.getByRole('searchbox')).toHaveFocus()
  await user.type(screen.getByRole('searchbox'),'zzzz')
  expect(screen.getByText('Nenhum módulo encontrado.')).toBeVisible()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('region',{name:'Resultados de navegação'})).not.toBeInTheDocument()
 })
 it('permite selecionar o resultado com o teclado',async()=>{
  const user=userEvent.setup();setup()
  await user.type(screen.getByRole('searchbox'),'produtos')
  await user.keyboard('{ArrowDown}{Enter}')
  expect(screen.getByRole('heading',{name:'Produtos abertos'})).toBeVisible()
 })
})
