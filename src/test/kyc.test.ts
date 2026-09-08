import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ rpc: vi.fn(), getSession: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: api.rpc, auth: { getSession: api.getSession } } }))

import {
  canSubmit, checkUploadFile, isValidTaxId, missingRequiredDocs, onlyDigits, profileFieldsComplete,
} from '../features/kyc/validation'
import { REQUIRED_DOCS } from '../features/kyc/types'
import { kycService } from '../features/kyc/kycService'

const file = (type: string, size: number, name = 'doc') =>
  new File([new Uint8Array(Math.max(1, size))], name, { type })

describe('kyc validation', () => {
  it('exige três documentos por tipo de pessoa', () => {
    expect(REQUIRED_DOCS.individual).toHaveLength(3)
    expect(REQUIRED_DOCS.company).toHaveLength(3)
    expect(REQUIRED_DOCS.company).toContain('company_registration')
  })

  it('valida CPF/CNPJ pelo número de dígitos', () => {
    expect(isValidTaxId('individual', '123.456.789-09')).toBe(true)
    expect(isValidTaxId('individual', '1234567890')).toBe(false)
    expect(isValidTaxId('company', '12.345.678/0001-90')).toBe(true)
    expect(onlyDigits('12.345.678/0001-90')).toBe('12345678000190')
  })

  it('aceita apenas JPG, PNG e PDF dentro do limite', () => {
    expect(checkUploadFile(file('image/png', 1024)).ok).toBe(true)
    expect(checkUploadFile(file('application/pdf', 1024)).ok).toBe(true)
    expect(checkUploadFile(file('image/gif', 1024)).ok).toBe(false)
    expect(checkUploadFile(file('image/png', 11 * 1024 * 1024)).ok).toBe(false)
  })

  it('só libera o envio com perfil completo e documentos presentes', () => {
    const profile = { personType: 'individual' as const, legalName: 'Fulano', taxId: '12345678909', companyName: '', status: 'draft' as const }
    expect(profileFieldsComplete(profile)).toBe(true)
    expect(missingRequiredDocs('individual', [{ docType: 'identity_front' }])).toEqual(['identity_back', 'proof_of_address'])
    expect(canSubmit(profile, [{ docType: 'identity_front' }])).toBe(false)
    expect(canSubmit(profile, REQUIRED_DOCS.individual.map(docType => ({ docType })))).toBe(true)
    expect(canSubmit({ ...profile, status: 'pending' }, REQUIRED_DOCS.individual.map(docType => ({ docType })))).toBe(false)
  })
})

describe('kycService.submit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('chama a RPC kyc_submit e mapeia o perfil', async () => {
    api.rpc.mockResolvedValue({ data: { user_id: 'u1', person_type: 'company', status: 'pending', legal_name: 'ACME', tax_id: '12345678000190' }, error: null })
    const profile = await kycService.submit()
    expect(api.rpc).toHaveBeenCalledWith('kyc_submit')
    expect(profile).toMatchObject({ userId: 'u1', personType: 'company', status: 'pending', legalName: 'ACME' })
  })

  it('traduz o erro de documentos ausentes', async () => {
    api.rpc.mockResolvedValue({ data: null, error: { message: 'KYC_DOCUMENTS_MISSING' } })
    await expect(kycService.submit()).rejects.toThrow('documentos obrigatórios')
  })
})
