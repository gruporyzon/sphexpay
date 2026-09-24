import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LandingPage from '../pages/public/LandingPage'

const auth = vi.hoisted(() => ({ user: null as null | { user_metadata: { onboarding_complete: boolean } } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: auth.user }) }))

afterEach(() => { cleanup(); auth.user = null })

describe('página pública de referência', () => {
  it('preserva seleção e navegação por teclado das abas de checkout', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    const tabs = screen.getByRole('tablist', { name: 'Recursos do checkout' })
    await user.click(within(tabs).getByRole('tab', { name: 'Recorrência' }))
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Recorrência')
    await user.keyboard('{ArrowRight}')
    expect(within(tabs).getByRole('tab', { name: 'Checkout Global' })).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Checkout Global')
  })

  it('preserva controles e seleção da galeria visual', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    // jsdom has no layout/scrolling engine; stub only this viewport's browser API.
    const viewport = screen.getByRole('region', { name: 'Showcase visual da plataforma SphexPay' })
    const scrollTo = vi.fn()
    viewport.scrollTo = scrollTo
    const tabs = screen.getByRole('tablist', { name: 'Selecionar showcase' })
    await user.click(screen.getByRole('button', { name: 'Próximo showcase' }))
    expect(within(tabs).getByRole('tab', { name: 'Mostrar Operações sem fronteiras.' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('button', { name: 'Showcase anterior' }))
    expect(within(tabs).getByRole('tab', { name: 'Mostrar Checkout sem fricção.' })).toHaveAttribute('aria-selected', 'true')
    expect(scrollTo).toHaveBeenCalledTimes(2)
  })

  it('identifica a prévia como demonstração e mantém um título principal', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    expect(screen.getByRole('region', { name: 'Prévia demonstrativa do dashboard SphexPay' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it.each([
    [null, '/criar-conta'],
    [{ user_metadata: { onboarding_complete: false } }, '/onboarding'],
    [{ user_metadata: { onboarding_complete: true } }, '/app'],
  ] as const)('preserva o destino do CTA para a sessão %j', (user, destination) => {
    auth.user = user
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    const hero = screen.getByRole('region', { name: /Você sempre no topo/ })
    expect(within(hero).getByRole('link', { name: 'Comece a vender' })).toHaveAttribute('href', destination)
    expect(within(hero).getByRole('link', { name: 'Ver como funciona' })).toHaveAttribute('href', '#experiencia')
  })
})
