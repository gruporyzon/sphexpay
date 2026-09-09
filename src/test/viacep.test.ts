import { afterEach, describe, expect, it, vi } from 'vitest'
import { lookupCep } from '../lib/viacep'

const mockFetch = (body: unknown, ok = true) =>
  vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) })

afterEach(() => { vi.unstubAllGlobals() })

describe('lookupCep', () => {
  it('não chama a rede para CEP incompleto', async () => {
    const fetchMock = mockFetch({})
    vi.stubGlobal('fetch', fetchMock)
    expect(await lookupCep('0131')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('mapeia a resposta do ViaCEP', async () => {
    vi.stubGlobal('fetch', mockFetch({
      logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP',
    }))
    expect(await lookupCep('01001-000')).toEqual({
      street: 'Praça da Sé', district: 'Sé', city: 'São Paulo', state: 'SP',
    })
  })

  it('retorna null quando o ViaCEP acusa CEP inexistente', async () => {
    vi.stubGlobal('fetch', mockFetch({ erro: true }))
    expect(await lookupCep('99999999')).toBeNull()
  })

  it('lança quando a rede falha', async () => {
    vi.stubGlobal('fetch', mockFetch(null, false))
    await expect(lookupCep('12345678')).rejects.toThrow()
  })
})
