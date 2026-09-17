import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublicOperationalExperience } from '../components/landing/PublicOperationalExperience'
import { useLandingMotion } from '../hooks/useLandingMotion'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('prévia mobile', () => {
  it('mostra o dashboard no aparelho com dados explicitamente demonstrativos', () => {
    const { container } = render(<PublicOperationalExperience />)
    expect(screen.getByRole('figure')).toHaveAccessibleName('Prévia demonstrativa da SphexPay no celular')
    expect(screen.getByText('Prévia da interface · dados demonstrativos')).toBeVisible()
    expect(screen.getByText('Saldo demonstrativo')).toBeVisible()
    expect(screen.getByRole('img', { name: 'Gráfico ilustrativo de evolução de vendas' })).toBeInTheDocument()
    expect(container.querySelector('.spx-device-island')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.spx-device-glass')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelectorAll('button, input, a')).toHaveLength(0)
  })
})

function MotionFixture() {
  useLandingMotion()
  return <div className="landing-redesign"><section className="landing-hero" data-scroll-progress><h1 data-motion>Conteúdo</h1><div data-depth data-testid="depth" /></section></div>
}

describe('preferência de movimento durante a navegação', () => {
  it('interrompe a profundidade, revela conteúdo e remove listeners ao desmontar', () => {
    let reduced = false
    const listeners = new Set<() => void>()
    const frames = new Map<number, FrameRequestCallback>()
    let frameId = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() { return query.includes('reduced-motion') ? reduced : true },
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    }))
    const flushFrames = () => act(() => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(0)) })
    const view = render(<MotionFixture />)
    const depth = screen.getByTestId('depth')
    fireEvent.pointerMove(depth, { clientX: 50, clientY: 50, pointerType: 'mouse' })
    flushFrames()
    expect(depth.style.getPropertyValue('--depth-x')).not.toBe('')
    act(() => { reduced = true; listeners.forEach(listener => listener()) })
    expect(depth.style.getPropertyValue('--depth-x')).toBe('')
    expect(screen.getByText('Conteúdo')).toHaveAttribute('data-motion-state', 'visible')
    fireEvent.pointerMove(depth, { clientX: 80, clientY: 80, pointerType: 'mouse' })
    flushFrames()
    expect(depth.style.getPropertyValue('--depth-x')).toBe('')
    view.unmount()
    expect(listeners.size).toBe(0)
    expect(frames.size).toBe(0)
  })
})
