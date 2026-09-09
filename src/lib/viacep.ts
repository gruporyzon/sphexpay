// Consulta de CEP via ViaCEP (https://viacep.com.br) — preenche o endereço a
// partir de um CEP válido. Sem chave, resposta pública, cacheada em memória.

import { onlyDigits } from './masks'

export interface CepAddress {
  street: string
  district: string
  city: string
  state: string
}

const cache = new Map<string, CepAddress | null>()

/**
 * Busca o endereço de um CEP. Retorna `null` quando o CEP tem 8 dígitos mas não
 * existe; lança quando a rede falha. Não faz nada (retorna `null`) para CEP incompleto.
 */
export async function lookupCep(cep: string, signal?: AbortSignal): Promise<CepAddress | null> {
  const digits = onlyDigits(cep)
  if (digits.length !== 8) return null
  if (cache.has(digits)) return cache.get(digits) ?? null

  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal })
  if (!response.ok) throw new Error('CEP_LOOKUP_FAILED')

  const data = (await response.json()) as Record<string, unknown>
  if (data.erro) {
    cache.set(digits, null)
    return null
  }

  const address: CepAddress = {
    street: String(data.logradouro || ''),
    district: String(data.bairro || ''),
    city: String(data.localidade || ''),
    state: String(data.uf || ''),
  }
  cache.set(digits, address)
  return address
}
