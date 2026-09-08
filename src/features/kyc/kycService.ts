import { supabase } from '../../lib/supabase'
import type {
  KycAddress,
  KycDocType,
  KycDocument,
  KycOverview,
  KycProfile,
  KycProfileInput,
  KycStatus,
  KycSubmissionSummary,
} from './types'
import { checkUploadFile, onlyDigits } from './validation'

const client = () => {
  if (!supabase) throw new Error('O módulo de verificação não está disponível neste ambiente.')
  return supabase
}

const PROFILE_COLUMNS =
  'user_id,person_type,legal_name,tax_id,company_name,trade_name,birth_date,phone,address,status,rejection_reason,submitted_at,reviewed_at,created_at,updated_at'
const DOCUMENT_COLUMNS =
  'id,user_id,doc_type,storage_path,original_filename,mime_type,byte_size,status,rejection_reason,uploaded_at'

const text = (value: unknown) => (typeof value === 'string' ? value : value == null ? '' : String(value))
const asAddress = (value: unknown): KycAddress =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as KycAddress) : {}

const profileFromRow = (row: Record<string, unknown>): KycProfile => ({
  userId: text(row.user_id),
  personType: (row.person_type === 'company' ? 'company' : 'individual'),
  legalName: text(row.legal_name),
  taxId: text(row.tax_id),
  companyName: text(row.company_name),
  tradeName: text(row.trade_name),
  birthDate: text(row.birth_date),
  phone: text(row.phone),
  address: asAddress(row.address),
  status: (text(row.status) || 'draft') as KycStatus,
  rejectionReason: text(row.rejection_reason),
  submittedAt: row.submitted_at ? text(row.submitted_at) : null,
  reviewedAt: row.reviewed_at ? text(row.reviewed_at) : null,
  createdAt: row.created_at ? text(row.created_at) : null,
  updatedAt: row.updated_at ? text(row.updated_at) : null,
})

const documentFromRow = (row: Record<string, unknown>): KycDocument => ({
  id: text(row.id),
  userId: text(row.user_id),
  docType: text(row.doc_type) as KycDocType,
  storagePath: text(row.storage_path),
  originalFilename: text(row.original_filename),
  mimeType: text(row.mime_type),
  byteSize: Number(row.byte_size || 0),
  status: (text(row.status) || 'pending') as KycDocument['status'],
  rejectionReason: text(row.rejection_reason),
  uploadedAt: text(row.uploaded_at),
  signedUrl: typeof row.signedUrl === 'string' ? row.signedUrl : (row.signedUrl === null ? null : undefined),
})

// supabase-js entrega o corpo em `data` só em respostas 2xx; em erro HTTP o código
// vem em `error.context` (um Response). Tentamos ler para dar uma mensagem útil.
const invokeErrorInfo = async (error: unknown): Promise<{ code?: string; status?: number; name?: string }> => {
  const err = error as { name?: string; context?: Response } | null
  const info: { code?: string; status?: number; name?: string } = { name: err?.name }
  const context = err?.context
  if (context && typeof context === 'object') {
    if (typeof context.status === 'number') info.status = context.status
    if (typeof context.json === 'function') {
      try {
        info.code = (await context.clone().json())?.code as string | undefined
      } catch {
        /* corpo não-JSON */
      }
    }
  }
  return info
}

const reviewInvoke = async <T>(payload: Record<string, unknown>): Promise<T> => {
  const { data, error } = await client().functions.invoke('kyc-review', { body: payload })
  const result = data as (T & { ok?: boolean; code?: string }) | null
  if (error || !result?.ok) {
    const info = result?.code ? { code: result.code } : await invokeErrorInfo(error)
    throw new Error(kycReviewMessage(info.code) || uploadFallbackMessage(info, 'a fila de verificação'))
  }
  return result
}

// Mensagem quando o código não foi reconhecido — inclui pistas para diagnóstico.
function uploadFallbackMessage(info: { status?: number; name?: string }, what = 'o documento'): string {
  if (info.name === 'FunctionsFetchError' || info.status === 404) {
    return `Serviço de verificação indisponível — a função ainda não foi publicada (deploy). Não foi possível enviar ${what}.`
  }
  if (info.status === 401 || info.status === 403) return 'Sua sessão expirou ou você não tem acesso. Entre novamente.'
  if (info.status) return `Não foi possível enviar ${what} (erro ${info.status}).`
  return `Não foi possível enviar ${what}.`
}

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

export const kycService = {
  async overview(userId: string): Promise<KycOverview> {
    const [profile, documents] = await Promise.all([
      client().from('kyc_profiles').select(PROFILE_COLUMNS).eq('user_id', userId).maybeSingle(),
      client().from('kyc_documents').select(DOCUMENT_COLUMNS).eq('user_id', userId).order('uploaded_at', { ascending: true }),
    ])
    if (profile.error) throw profile.error
    if (documents.error) throw documents.error
    return {
      profile: profile.data ? profileFromRow(profile.data as Record<string, unknown>) : null,
      documents: (documents.data || []).map(row => documentFromRow(row as Record<string, unknown>)),
    }
  },

  async saveProfile(userId: string, input: KycProfileInput): Promise<KycProfile> {
    const payload = {
      user_id: userId,
      person_type: input.personType,
      legal_name: input.legalName.trim() || null,
      tax_id: onlyDigits(input.taxId) || null,
      company_name: input.personType === 'company' ? input.companyName.trim() || null : null,
      trade_name: input.personType === 'company' ? input.tradeName.trim() || null : null,
      birth_date: input.personType === 'individual' && input.birthDate ? input.birthDate : null,
      phone: input.phone.trim() || null,
      address: input.address ?? {},
    }
    const { data, error } = await client()
      .from('kyc_profiles').upsert(payload, { onConflict: 'user_id' }).select(PROFILE_COLUMNS).single()
    if (error) throw error
    return profileFromRow(data as Record<string, unknown>)
  },

  async uploadDocument(docType: KycDocType, file: File): Promise<void> {
    const check = checkUploadFile(file)
    if (!check.ok) throw new Error(check.message)
    const body = new FormData()
    body.append('file', file)
    body.append('docType', docType)
    const { data, error } = await client().functions.invoke('kyc-document-upload', { body })
    if (error || !(data as { id?: string })?.id) {
      const inline = (data as { code?: string })?.code
      const info = inline ? { code: inline } : await invokeErrorInfo(error)
      throw new Error(kycUploadMessage(info.code) || uploadFallbackMessage(info))
    }
  },

  async documentUrl(path?: string | null): Promise<string> {
    if (!path) return ''
    const cached = signedUrlCache.get(path)
    if (cached && cached.expiresAt > Date.now()) return cached.url
    const { data, error } = await client().storage.from('kyc-documents').createSignedUrl(path, 300)
    if (error || !data?.signedUrl) throw error || new Error('SIGNED_URL_FAILED')
    signedUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + 240_000 })
    return data.signedUrl
  },

  async submit(): Promise<KycProfile> {
    const { data, error } = await client().rpc('kyc_submit')
    if (error) throw new Error(kycSubmitMessage(error.message))
    return profileFromRow(data as Record<string, unknown>)
  },

  async adminList(status?: string): Promise<KycSubmissionSummary[]> {
    const body = await reviewInvoke<{ items?: Record<string, unknown>[] }>({ action: 'list', status: status || '' })
    return (body.items || []).map(row => ({
      ...profileFromRow(row),
      documents: (row.documents as KycSubmissionSummary['documents']) || { total: 0, approved: 0, rejected: 0, pending: 0 },
    }))
  },

  async adminDetail(userId: string): Promise<KycOverview> {
    const body = await reviewInvoke<{ profile?: Record<string, unknown>; documents?: Record<string, unknown>[] }>({
      action: 'detail', userId,
    })
    return {
      profile: body.profile ? profileFromRow(body.profile) : null,
      documents: (body.documents || []).map(documentFromRow),
    }
  },

  async adminReviewDocument(id: string, decision: 'approved' | 'rejected', reason?: string): Promise<void> {
    await reviewInvoke({ action: 'review', target: 'document', id, decision, reason })
  },

  async adminReviewProfile(
    userId: string,
    decision: 'approved' | 'rejected' | 'needs_more_info',
    reason?: string,
  ): Promise<void> {
    await reviewInvoke({ action: 'review', target: 'profile', userId, decision, reason })
  },
}

function kycReviewMessage(code?: string): string {
  switch (code) {
    case 'FORBIDDEN': return 'Acesso restrito à equipe de verificação.'
    case 'UNAUTHORIZED': return 'Sua sessão expirou. Entre novamente.'
    case 'REASON_REQUIRED': return 'Informe o motivo para o merchant.'
    case 'NOT_FOUND': return 'Submissão não encontrada.'
    case 'INVALID_DECISION': return 'Decisão inválida.'
    default: return ''
  }
}

function kycUploadMessage(code?: string): string {
  switch (code) {
    case 'INVALID_SIZE': return 'O arquivo deve ter entre alguns KB e 10 MB.'
    case 'INVALID_MIME':
    case 'EXTENSION_MISMATCH': return 'Formato não aceito. Envie JPG, PNG ou PDF.'
    case 'MIME_SIGNATURE_MISMATCH': return 'O arquivo parece corrompido ou não corresponde ao formato.'
    case 'PROFILE_REQUIRED': return 'Preencha e salve seus dados antes de enviar documentos.'
    case 'PROFILE_LOCKED': return 'O cadastro já foi aprovado e não aceita novos envios.'
    case 'PROFILE_LOOKUP_FAILED': return 'As tabelas de verificação ainda não foram criadas no banco (aplique a migration).'
    case 'SERVER_NOT_CONFIGURED': return 'A função de upload não está configurada (secrets do Supabase ausentes).'
    case 'UPLOAD_FAILED': return 'Falha ao gravar no armazenamento — confira se o bucket "kyc-documents" existe.'
    case 'PERSIST_FAILED': return 'O arquivo subiu mas não foi possível registrar o documento.'
    case 'UNAUTHORIZED': return 'Sua sessão expirou. Entre novamente.'
    case 'INVALID_UPLOAD': return 'Envio inválido. Recarregue a página e tente de novo.'
    default: return ''
  }
}

function kycSubmitMessage(raw?: string): string {
  const message = (raw || '').toUpperCase()
  if (message.includes('KYC_PROFILE_NOT_FOUND')) return 'Preencha e salve seus dados antes de enviar para análise.'
  if (message.includes('KYC_ALREADY_SUBMITTED')) return 'Seu cadastro já está em análise.'
  if (message.includes('KYC_ALREADY_APPROVED')) return 'Seu cadastro já foi aprovado.'
  if (message.includes('KYC_PROFILE_INCOMPLETE')) return 'Complete os dados obrigatórios do cadastro.'
  if (message.includes('KYC_DOCUMENTS_MISSING')) return 'Envie todos os documentos obrigatórios antes de continuar.'
  return 'Não foi possível enviar seu cadastro para análise.'
}
