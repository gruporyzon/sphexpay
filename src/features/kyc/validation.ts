import { REQUIRED_DOCS, type KycDocType, type KycDocument, type KycPersonType, type KycProfile } from './types'

export const KYC_UPLOAD_MAX_BYTES = 10 * 1024 * 1024
export const KYC_UPLOAD_MIMES = ['image/jpeg', 'image/png', 'application/pdf'] as const
export const KYC_UPLOAD_ACCEPT = '.jpg,.jpeg,.png,.pdf'

export type KycFileCheck = { ok: true } | { ok: false; message: string }

// Validação leve no cliente — a verificação real (magic bytes) é na Edge Function.
export function checkUploadFile(file: File): KycFileCheck {
  if (!KYC_UPLOAD_MIMES.includes(file.type as (typeof KYC_UPLOAD_MIMES)[number])) {
    return { ok: false, message: 'Envie um arquivo JPG, PNG ou PDF.' }
  }
  if (file.size <= 0 || file.size > KYC_UPLOAD_MAX_BYTES) {
    return { ok: false, message: 'O arquivo deve ter até 10 MB.' }
  }
  return { ok: true }
}

export function onlyDigits(value: string): string {
  return (value || '').replace(/\D+/g, '')
}

export function isValidTaxId(personType: KycPersonType, taxId: string): boolean {
  const digits = onlyDigits(taxId)
  return personType === 'company' ? digits.length === 14 : digits.length === 11
}

export function profileFieldsComplete(profile: Pick<KycProfile, 'personType' | 'legalName' | 'taxId' | 'companyName'>): boolean {
  if (!profile.legalName.trim()) return false
  if (!isValidTaxId(profile.personType, profile.taxId)) return false
  if (profile.personType === 'company' && !profile.companyName.trim()) return false
  return true
}

export function missingRequiredDocs(personType: KycPersonType, documents: Pick<KycDocument, 'docType'>[]): KycDocType[] {
  const present = new Set(documents.map(doc => doc.docType))
  return REQUIRED_DOCS[personType].filter(docType => !present.has(docType))
}

export function canSubmit(
  profile: Pick<KycProfile, 'personType' | 'legalName' | 'taxId' | 'companyName' | 'status'>,
  documents: Pick<KycDocument, 'docType'>[],
): boolean {
  if (profile.status === 'pending' || profile.status === 'approved') return false
  return profileFieldsComplete(profile) && missingRequiredDocs(profile.personType, documents).length === 0
}
