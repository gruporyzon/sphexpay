import { render, screen, within, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import LandingPage from '../pages/public/LandingPage'

const auth = vi.hoisted(() => ({ user: null as null | { user_metadata: { onboarding_complete: boolean } } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: auth.user }) }))
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
})
afterEach(() => { cleanup(); auth.user = null; vi.restoreAllMocks() })
const renderPage = () => render(<MemoryRouter><LandingPage /></MemoryRouter>)

describe('entrada SphexPay', () => {
  it('preserva a navegação acessível por teclado entre jornadas de checkout', async () => {
    const user = userEvent.setup()
    renderPage()
    const tabs = screen.getByRole('tablist', { name: 'Explorar jornada de venda' })
    await user.click(within(tabs).getByRole('tab', { name: 'Funil e checkout' }))
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Funil e checkout')
    expect(screen.getByRole('heading', { name: 'Checkout personalizável' })).toBeVisible()
    await user.keyboard('{ArrowLeft}')
    expect(within(tabs).getByRole('tab', { name: 'Jornada de compra' })).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Jornada de compra')
  })

  it('abre o menu, mantém o foco e fecha ao escolher uma seção', async () => {
    const user = userEvent.setup()
    renderPage()
    const trigger = screen.getByLabelText('Abrir menu de navegação')
    await user.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Menu de navegação' })
    expect(within(dialog).getByRole('button', { name: 'Fechar menu' })).toHaveFocus()
    await user.click(within(dialog).getByRole('link', { name: /Acessar produtos/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('permite pausar o movimento do carrossel', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Pausar carrossel' }))
    expect(screen.getByRole('button', { name: 'Reproduzir carrossel' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('permite selecionar a última premiação e voltar pela seta', async () => {
    const user = userEvent.setup()
    renderPage()
    const viewport = screen.getByRole('region', { name: 'Premiações SphexPay' })
    viewport.scrollTo = vi.fn()
    await user.click(screen.getByRole('button', { name: 'Premiação 5M+' }))
    expect(screen.getByRole('button', { name: 'Premiação 5M+' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Próxima premiação' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Premiação anterior' }))
    expect(screen.getByRole('button', { name: 'Premiação 1M' })).toHaveAttribute('aria-pressed', 'true')
    expect(viewport.scrollTo).toHaveBeenCalledTimes(2)
  })

  it('mantém a central de ajuda e um único título principal', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Dúvidas sobre a SphexPay' }))
    expect(screen.getByRole('button', { name: 'Dúvidas sobre a SphexPay' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /O que é a SphexPay/ })).toBeVisible()
    expect(screen.queryByText(/Até 98%/)).not.toBeInTheDocument()
    expect(screen.queryByText(/3.000 operações/)).not.toBeInTheDocument()
  })

  it.each([
    [null, '/criar-conta'],
    [{ user_metadata: { onboarding_complete: false } }, '/onboarding'],
    [{ user_metadata: { onboarding_complete: true } }, '/app'],
  ] as const)('preserva o destino do CTA para a sessão %j', (user, destination) => {
    auth.user = user
    renderPage()
    const hero = screen.getByRole('region', { name: /Um único ecossistema/ })
    expect(within(hero).getByRole('link', { name: 'Quero conhecer a SphexPay' })).toHaveAttribute('href', destination)
    expect(within(hero).getByRole('link', { name: 'Explorar produtos' })).toHaveAttribute('href', '#produtos')
  })
})
