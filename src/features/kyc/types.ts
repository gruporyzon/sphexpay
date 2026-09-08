export type KycStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'needs_more_info'
export type KycPersonType = 'individual' | 'company'
export type KycDocType =
  | 'identity_front'
  | 'identity_back'
  | 'proof_of_address'
  | 'company_registration'
  | 'company_tax_card'
  | 'representative_document'
export type KycDocumentStatus = 'pending' | 'approved' | 'rejected'

export interface KycAddress {
  street?: string
  number?: string
  complement?: string
  district?: string
  city?: string
  state?: string
  zip?: string
}

export interface KycProfile {
  userId: string
  personType: KycPersonType
  legalName: string
  taxId: string
  companyName: string
  tradeName: string
  birthDate: string
  phone: string
  address: KycAddress
  status: KycStatus
  rejectionReason: string
  submittedAt: string | null
  reviewedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface KycDocument {
  id: string
  userId: string
  docType: KycDocType
  storagePath: string
  originalFilename: string
  mimeType: string
  byteSize: number
  status: KycDocumentStatus
  rejectionReason: string
  uploadedAt: string
  signedUrl?: string | null
}

export interface KycOverview {
  profile: KycProfile | null
  documents: KycDocument[]
}

export interface KycSubmissionSummary extends KycProfile {
  documents: { total: number; approved: number; rejected: number; pending: number }
}

export interface KycProfileInput {
  personType: KycPersonType
  legalName: string
  taxId: string
  companyName: string
  tradeName: string
  birthDate: string
  phone: string
  address: KycAddress
}

export const REQUIRED_DOCS: Record<KycPersonType, KycDocType[]> = {
  individual: ['identity_front', 'identity_back', 'proof_of_address'],
  company: ['company_registration', 'proof_of_address', 'representative_document'],
}

export const DOC_LABELS: Record<KycDocType, { title: string; hint: string }> = {
  identity_front: { title: 'Documento de identidade (frente)', hint: 'RG ou CNH — frente, legível, sem cortes.' },
  identity_back: { title: 'Documento de identidade (verso)', hint: 'RG ou CNH — verso.' },
  proof_of_address: { title: 'Comprovante de endereço', hint: 'Conta de consumo ou similar dos últimos 90 dias.' },
  company_registration: { title: 'Contrato social / registro da empresa', hint: 'Última alteração consolidada ou requerimento MEI.' },
  company_tax_card: { title: 'Cartão CNPJ', hint: 'Comprovante de inscrição e situação cadastral (opcional).' },
  representative_document: { title: 'Documento do representante legal', hint: 'RG ou CNH de quem responde pela empresa.' },
}

export const STATUS_LABELS: Record<KycStatus, string> = {
  draft: 'Rascunho',
  pending: 'Em análise',
  approved: 'Aprovado',
  rejected: 'Reprovado',
  needs_more_info: 'Ajustes solicitados',
}

export const STATUS_TONE: Record<KycStatus, 'neutral' | 'ok' | 'warn' | 'bad' | 'info'> = {
  draft: 'neutral',
  pending: 'info',
  approved: 'ok',
  rejected: 'bad',
  needs_more_info: 'warn',
}

export const DOC_STATUS_LABELS: Record<KycDocumentStatus, string> = {
  pending: 'Em análise',
  approved: 'Aprovado',
  rejected: 'Reprovado',
}
