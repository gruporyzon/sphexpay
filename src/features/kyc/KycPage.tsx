import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle, CheckCircle2, ClipboardCheck, FileText, Loader2, ShieldCheck, Upload, UserCog,
} from 'lucide-react'
import { Badge, Button, Card, Empty, Loading, Modal, StateMessage } from '../../components/ui'
import { MaskedField, PhoneField, TextField } from '../../components/forms'
import { useAuth } from '../../hooks/useAuth'
import { useDashboardAdmin } from '../../hooks/useDashboardAdmin'
import { maskCEP, maskCpfCnpj, maskPhoneBR, maskUF, onlyDigits } from '../../lib/masks'
import { lookupCep } from '../../lib/viacep'
import { kycService } from './kycService'
import {
  DOC_LABELS, DOC_STATUS_LABELS, REQUIRED_DOCS, STATUS_LABELS, STATUS_TONE,
  type KycDocType, type KycDocument, type KycOverview, type KycPersonType, type KycProfile,
  type KycProfileInput, type KycSubmissionSummary,
} from './types'
import { KYC_UPLOAD_ACCEPT, canSubmit, isValidTaxId, missingRequiredDocs } from './validation'
import './kyc.css'

const dateTime = (value: string | null) =>
  value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'

const emptyInput: KycProfileInput = {
  personType: 'individual', legalName: '', taxId: '', companyName: '', tradeName: '', birthDate: '', phone: '',
  address: {},
}

const toInput = (profile: KycProfile | null): KycProfileInput =>
  profile
    ? {
      personType: profile.personType, legalName: profile.legalName, taxId: maskCpfCnpj(profile.taxId),
      companyName: profile.companyName, tradeName: profile.tradeName, birthDate: profile.birthDate,
      phone: maskPhoneBR(profile.phone),
      address: {
        ...profile.address,
        ...(profile.address.state ? { state: maskUF(profile.address.state) } : {}),
        ...(profile.address.zip ? { zip: maskCEP(profile.address.zip) } : {}),
      },
    }
    : emptyInput

export default function KycPage() {
  const { user } = useAuth()
  const admin = useDashboardAdmin(user?.id)
  const [tab, setTab] = useState<'profile' | 'review'>('profile')

  useEffect(() => {
    if (!admin.allowed && tab === 'review') setTab('profile')
  }, [admin.allowed, tab])

  return (
    <section className="kyc-page page-enter" aria-labelledby="kyc-title">
      <header className="kyc-heading">
        <div>
          <span className="kyc-eyebrow"><ShieldCheck size={14} /> Verificação de cadastro</span>
          <h1 id="kyc-title">Documentos e liberação da operação</h1>
          <p>Envie seus dados e documentos para análise de compliance. A operação é liberada após a aprovação.</p>
        </div>
      </header>

      {admin.allowed && (
        <nav className="kyc-tabs" aria-label="Seções de verificação">
          <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')} aria-current={tab === 'profile' ? 'page' : undefined}>
            <UserCog size={16} /> Meu cadastro
          </button>
          <button className={tab === 'review' ? 'active' : ''} onClick={() => setTab('review')} aria-current={tab === 'review' ? 'page' : undefined}>
            <ClipboardCheck size={16} /> Análise (admin)
          </button>
        </nav>
      )}

      {tab === 'review' && admin.allowed ? <AdminReview /> : <MerchantKyc userId={user?.id} />}
    </section>
  )
}

/* ---------------------------------------------------------------- merchant */

function MerchantKyc({ userId }: { userId?: string }) {
  const [overview, setOverview] = useState<KycOverview>({ profile: null, documents: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [input, setInput] = useState<KycProfileInput>(emptyInput)
  const [savingProfile, setSavingProfile] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    setLoading(true); setError('')
    try {
      const next = await kycService.overview(userId)
      setOverview(next)
      setInput(toInput(next.profile))
    } catch {
      setError('Não foi possível carregar seu cadastro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { void load() }, [load])

  const status = overview.profile?.status ?? 'draft'
  const locked = status === 'pending' || status === 'approved'
  const required = REQUIRED_DOCS[input.personType]
  const missing = missingRequiredDocs(input.personType, overview.documents)
  const submittable = overview.profile
    ? canSubmit({ ...overview.profile, personType: input.personType }, overview.documents)
    : false

  const set = <K extends keyof KycProfileInput>(key: K, value: KycProfileInput[K]) =>
    setInput(current => ({ ...current, [key]: value }))
  const setAddress = (key: keyof KycProfileInput['address'], value: string) =>
    setInput(current => ({ ...current, address: { ...current.address, [key]: value } }))

  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'notfound' | 'error'>('idle')
  const cepLookup = useRef<AbortController | null>(null)

  const runCepLookup = useCallback(async (digits: string) => {
    cepLookup.current?.abort()
    const controller = new AbortController()
    cepLookup.current = controller
    setCepStatus('loading')
    try {
      const found = await lookupCep(digits, controller.signal)
      if (controller.signal.aborted) return
      if (!found) { setCepStatus('notfound'); return }
      setCepStatus('idle')
      setInput(current => ({
        ...current,
        address: {
          ...current.address,
          street: found.street || current.address.street,
          district: found.district || current.address.district,
          city: found.city || current.address.city,
          state: found.state || current.address.state,
        },
      }))
    } catch {
      if (!controller.signal.aborted) setCepStatus('error')
    }
  }, [])

  const onZipChange = (value: string) => {
    setAddress('zip', value)
    const digits = onlyDigits(value)
    if (digits.length === 8) void runCepLookup(digits)
    else setCepStatus('idle')
  }

  useEffect(() => () => cepLookup.current?.abort(), [])

  const saveProfile = async () => {
    if (!userId) return
    if (!input.legalName.trim()) { setFeedback({ tone: 'error', text: 'Informe o nome completo ou a razão social.' }); return }
    if (!isValidTaxId(input.personType, input.taxId)) {
      setFeedback({ tone: 'error', text: input.personType === 'company' ? 'CNPJ deve ter 14 dígitos.' : 'CPF deve ter 11 dígitos.' })
      return
    }
    setSavingProfile(true); setFeedback(null)
    try {
      const profile = await kycService.saveProfile(userId, input)
      setOverview(current => ({ ...current, profile }))
      setFeedback({ tone: 'success', text: 'Dados salvos.' })
    } catch {
      setFeedback({ tone: 'error', text: 'Não foi possível salvar seus dados. Tente novamente.' })
    } finally {
      setSavingProfile(false)
    }
  }

  const submit = async () => {
    setSubmitting(true); setFeedback(null)
    try {
      const profile = await kycService.submit()
      setOverview(current => ({ ...current, profile }))
      setFeedback({ tone: 'success', text: 'Cadastro enviado para análise.' })
    } catch (reason) {
      setFeedback({ tone: 'error', text: reason instanceof Error ? reason.message : 'Não foi possível enviar para análise.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Loading label="Carregando seu cadastro" />
  if (error) return <StateMessage title="Erro ao carregar">{error} <button className="kyc-inline-retry" onClick={() => void load()}>Tentar novamente</button></StateMessage>

  return (
    <div className="kyc-merchant">
      <StatusPanel profile={overview.profile} />

      <Card className="kyc-card">
        <div className="kyc-card-head">
          <h2><UserCog size={18} /> Dados do cadastro</h2>
          <PersonTypeToggle value={input.personType} disabled={locked} onChange={value => set('personType', value)} />
        </div>

        <div className="kyc-grid">
          <TextField label={input.personType === 'company' ? 'Razão social' : 'Nome completo'} value={input.legalName}
            disabled={locked} onChange={value => set('legalName', value)} />
          <MaskedField label={input.personType === 'company' ? 'CNPJ' : 'CPF'} value={input.taxId}
            mask={input.personType === 'company' ? 'cnpj' : 'cpf'}
            disabled={locked} onChange={value => set('taxId', value)} />
          {input.personType === 'company' ? (
            <>
              <TextField label="Nome fantasia" value={input.tradeName} disabled={locked} onChange={value => set('tradeName', value)} />
              <PhoneField label="Telefone" value={input.phone} disabled={locked} onChange={value => set('phone', value)} />
            </>
          ) : (
            <>
              <TextField label="Data de nascimento" type="date" value={input.birthDate} disabled={locked} onChange={value => set('birthDate', value)} />
              <PhoneField label="Telefone" value={input.phone} disabled={locked} onChange={value => set('phone', value)} />
            </>
          )}
        </div>

        <fieldset className="kyc-fieldset" disabled={locked}>
          <legend>Endereço</legend>
          <div className="kyc-grid">
            <MaskedField label="CEP" mask="cep" value={input.address.zip || ''} onChange={onZipChange}
              autoComplete="postal-code"
              invalid={cepStatus === 'notfound'}
              hint={cepStatus === 'notfound' ? 'CEP não encontrado — preencha o endereço manualmente.' : undefined} />
            <TextField label="Número" value={input.address.number || ''} inputMode="numeric" onChange={value => setAddress('number', value)} />
            <TextField label="Logradouro" value={input.address.street || ''} onChange={value => setAddress('street', value)} />
            <TextField label="Complemento" value={input.address.complement || ''} onChange={value => setAddress('complement', value)} />
            <TextField label="Bairro" value={input.address.district || ''} onChange={value => setAddress('district', value)} />
            <TextField label="Cidade" value={input.address.city || ''} onChange={value => setAddress('city', value)} />
            <MaskedField label="UF" mask="uf" value={input.address.state || ''} onChange={value => setAddress('state', value)} />
          </div>
          {cepStatus === 'loading' && <p className="kyc-cep-status">Buscando endereço pelo CEP…</p>}
          {cepStatus === 'error' && <p className="kyc-cep-status is-warn">Não foi possível consultar o CEP agora. Preencha o endereço manualmente.</p>}
        </fieldset>

        {!locked && (
          <div className="kyc-card-actions">
            <Button variant="primary" onClick={() => void saveProfile()} disabled={savingProfile}>
              {savingProfile ? <Loader2 className="kyc-spin" size={16} /> : <CheckCircle2 size={16} />} Salvar dados
            </Button>
          </div>
        )}
      </Card>

      <Card className="kyc-card">
        <div className="kyc-card-head"><h2><FileText size={18} /> Documentos</h2></div>
        <p className="kyc-card-note">Formatos aceitos: JPG, PNG ou PDF, até 10 MB por arquivo.</p>
        <div className="kyc-doc-grid">
          {required.map(docType => (
            <DocumentCard key={docType} docType={docType} locked={locked}
              document={overview.documents.find(doc => doc.docType === docType) || null}
              onChanged={load} onFeedback={setFeedback} />
          ))}
        </div>
      </Card>

      {feedback && <FeedbackModal tone={feedback.tone} text={feedback.text} onClose={() => setFeedback(null)} />}

      {!locked && (
        <Card className="kyc-submit-bar">
          <div>
            <b>Enviar para análise</b>
            <p>
              {submittable
                ? 'Tudo pronto. O time de compliance retorna em até 2 dias úteis.'
                : missing.length
                  ? `Faltam documentos: ${missing.map(type => DOC_LABELS[type].title).join(', ')}.`
                  : 'Complete e salve os dados obrigatórios do cadastro.'}
            </p>
          </div>
          <Button variant="primary" disabled={!submittable || submitting} onClick={() => void submit()}>
            {submitting ? <Loader2 className="kyc-spin" size={16} /> : <ShieldCheck size={16} />} Enviar para análise
          </Button>
        </Card>
      )}
    </div>
  )
}

function StatusPanel({ profile }: { profile: KycProfile | null }) {
  const status = profile?.status ?? 'draft'
  return (
    <Card className={`kyc-status-panel is-${status}`}>
      <div className="kyc-status-icon">
        {status === 'approved' ? <CheckCircle2 /> : status === 'rejected' || status === 'needs_more_info' ? <AlertTriangle /> : <ShieldCheck />}
      </div>
      <div className="kyc-status-copy">
        <div className="kyc-status-line">
          <span>Situação do cadastro</span>
          <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>
        </div>
        <p>
          {status === 'approved' && 'Seu cadastro foi aprovado. Sua operação está liberada.'}
          {status === 'pending' && `Enviado em ${dateTime(profile?.submittedAt ?? null)}. Aguarde a análise.`}
          {status === 'draft' && 'Preencha os dados e envie os documentos para iniciar a análise.'}
          {status === 'rejected' && (profile?.rejectionReason || 'Seu cadastro foi reprovado. Ajuste os dados e reenvie.')}
          {status === 'needs_more_info' && (profile?.rejectionReason || 'O time solicitou ajustes. Corrija e reenvie.')}
        </p>
      </div>
    </Card>
  )
}

function FeedbackModal({ tone, text, onClose }: { tone: 'error' | 'success'; text: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const timer = tone === 'success' ? window.setTimeout(onClose, 2400) : undefined
    return () => { window.removeEventListener('keydown', onKey); if (timer) window.clearTimeout(timer) }
  }, [tone, onClose])

  return createPortal(
    <div className="modal-backdrop kyc-feedback-backdrop" onMouseDown={onClose}>
      <div className={`kyc-feedback is-${tone}`} role="alertdialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
        <span className="kyc-feedback-icon">{tone === 'error' ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}</span>
        <p>{text}</p>
        <Button variant="primary" onClick={onClose} autoFocus>Entendi</Button>
      </div>
    </div>,
    document.body,
  )
}

function PersonTypeToggle({ value, onChange, disabled }: { value: KycPersonType; onChange: (value: KycPersonType) => void; disabled?: boolean }) {
  return (
    <div className="kyc-person-toggle" role="group" aria-label="Tipo de pessoa">
      {(['individual', 'company'] as KycPersonType[]).map(option => (
        <button key={option} type="button" className={value === option ? 'active' : ''} disabled={disabled} onClick={() => onChange(option)}>
          {option === 'individual' ? 'Pessoa física' : 'Pessoa jurídica'}
        </button>
      ))}
    </div>
  )
}

function DocumentCard({ docType, document, locked, onChanged, onFeedback }: {
  docType: KycDocType; document: KycDocument | null; locked: boolean
  onChanged: () => Promise<void> | void
  onFeedback: (value: { tone: 'error' | 'success'; text: string }) => void
}) {
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState('')
  const label = DOC_LABELS[docType]

  useEffect(() => {
    let active = true
    if (!document?.storagePath || document.mimeType === 'application/pdf') { setPreview(''); return }
    kycService.documentUrl(document.storagePath).then(url => { if (active) setPreview(url) }).catch(() => undefined)
    return () => { active = false }
  }, [document?.storagePath, document?.mimeType])

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      await kycService.uploadDocument(docType, file)
      onFeedback({ tone: 'success', text: `${label.title}: enviado.` })
      await onChanged()
    } catch (reason) {
      onFeedback({ tone: 'error', text: reason instanceof Error ? reason.message : 'Falha ao enviar o documento.' })
    } finally {
      setBusy(false)
    }
  }

  const openFile = async () => {
    if (!document?.storagePath) return
    try {
      const url = await kycService.documentUrl(document.storagePath)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      onFeedback({ tone: 'error', text: 'Não foi possível abrir o documento.' })
    }
  }

  return (
    <article className={`kyc-doc-card${document ? ` is-${document.status}` : ''}`}>
      <header>
        <div>
          <b>{label.title}</b>
          <small>{label.hint}</small>
        </div>
        {document && <Badge tone={document.status === 'approved' ? 'ok' : document.status === 'rejected' ? 'bad' : 'info'}>{DOC_STATUS_LABELS[document.status]}</Badge>}
      </header>

      {document && (
        <div className="kyc-doc-body">
          {preview
            ? <button type="button" className="kyc-doc-thumb" onClick={() => void openFile()}><img src={preview} alt={label.title} /></button>
            : <button type="button" className="kyc-doc-file" onClick={() => void openFile()}><FileText size={16} /> {document.originalFilename || 'Ver documento'}</button>}
          {document.status === 'rejected' && document.rejectionReason && <p className="kyc-doc-reason">{document.rejectionReason}</p>}
        </div>
      )}

      {!locked && (
        <label className={`kyc-doc-upload${busy ? ' is-busy' : ''}`}>
          {busy ? <Loader2 className="kyc-spin" size={16} /> : <Upload size={16} />}
          <span>{document ? 'Substituir arquivo' : 'Enviar arquivo'}</span>
          <input type="file" accept={KYC_UPLOAD_ACCEPT} disabled={busy}
            onChange={event => { void upload(event.target.files?.[0]); event.target.value = '' }} />
        </label>
      )}
    </article>
  )
}

/* ------------------------------------------------------------------- admin */

const REVIEW_FILTERS: { value: string; label: string }[] = [
  { value: 'pending', label: 'Em análise' },
  { value: 'needs_more_info', label: 'Ajustes solicitados' },
  { value: 'approved', label: 'Aprovados' },
  { value: 'rejected', label: 'Reprovados' },
  { value: '', label: 'Todos' },
]

function AdminReview() {
  const [status, setStatus] = useState('pending')
  const [items, setItems] = useState<KycSubmissionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openUser, setOpenUser] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      setItems(await kycService.adminList(status))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a fila.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { void load() }, [load])

  return (
    <div className="kyc-admin">
      <div className="kyc-admin-filters" role="tablist" aria-label="Filtrar submissões">
        {REVIEW_FILTERS.map(filter => (
          <button key={filter.value || 'all'} role="tab" aria-selected={status === filter.value}
            className={status === filter.value ? 'active' : ''} onClick={() => setStatus(filter.value)}>
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? <Loading label="Carregando a fila" />
        : error ? <StateMessage title="Erro">{error} <button className="kyc-inline-retry" onClick={() => void load()}>Tentar novamente</button></StateMessage>
        : !items.length ? <Empty title="Nada na fila" text="Nenhuma submissão para este filtro." />
        : (
          <Card className="kyc-admin-table">
            <table>
              <thead><tr><th>Merchant</th><th>Tipo</th><th>Documentos</th><th>Enviado</th><th>Status</th><th /></tr></thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.userId}>
                    <td><b>{item.legalName || item.companyName || 'Sem nome'}</b><small>{item.taxId ? maskCpfCnpj(item.taxId) : '—'}</small></td>
                    <td>{item.personType === 'company' ? 'PJ' : 'PF'}</td>
                    <td>{item.documents.approved}/{item.documents.total} aprovados</td>
                    <td>{dateTime(item.submittedAt)}</td>
                    <td><Badge tone={STATUS_TONE[item.status]}>{STATUS_LABELS[item.status]}</Badge></td>
                    <td><Button size="sm" variant="ghost" onClick={() => setOpenUser(item.userId)}>Analisar</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

      {openUser && <ReviewModal userId={openUser} onClose={() => setOpenUser(null)} onReviewed={() => { setOpenUser(null); void load() }} />}
    </div>
  )
}

function ReviewModal({ userId, onClose, onReviewed }: { userId: string; onClose: () => void; onReviewed: () => void }) {
  const [detail, setDetail] = useState<KycOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      setDetail(await kycService.adminDetail(userId))
    } catch (reasonError) {
      setError(reasonError instanceof Error ? reasonError.message : 'Não foi possível carregar a submissão.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { void load() }, [load])

  const profile = detail?.profile
  const run = async (action: () => Promise<void>, key: string) => {
    setBusy(key); setError('')
    try {
      await action()
      onReviewed()
    } catch (reasonError) {
      setError(reasonError instanceof Error ? reasonError.message : 'Não foi possível registrar a decisão.')
      setBusy('')
    }
  }

  return (
    <Modal title="Análise de cadastro" onClose={onClose} className="kyc-review-modal">
      {loading ? <Loading label="Carregando submissão" />
        : !profile ? <StateMessage title="Erro">{error || 'Submissão não encontrada.'}</StateMessage>
        : (
          <div className="kyc-review-body">
            <dl className="kyc-review-facts">
              <div><dt>Nome / Razão social</dt><dd>{profile.legalName || '—'}</dd></div>
              <div><dt>Tipo</dt><dd>{profile.personType === 'company' ? 'Pessoa jurídica' : 'Pessoa física'}</dd></div>
              <div><dt>{profile.personType === 'company' ? 'CNPJ' : 'CPF'}</dt><dd>{profile.taxId ? maskCpfCnpj(profile.taxId) : '—'}</dd></div>
              {profile.personType === 'company' && <div><dt>Nome fantasia</dt><dd>{profile.tradeName || '—'}</dd></div>}
              {profile.personType === 'individual' && <div><dt>Nascimento</dt><dd>{profile.birthDate || '—'}</dd></div>}
              <div><dt>Telefone</dt><dd>{profile.phone ? maskPhoneBR(profile.phone) : '—'}</dd></div>
              <div><dt>Endereço</dt><dd>{[profile.address.street, profile.address.number, profile.address.city, profile.address.state].filter(Boolean).join(', ') || '—'}</dd></div>
              <div><dt>Enviado</dt><dd>{dateTime(profile.submittedAt)}</dd></div>
            </dl>

            <h3>Documentos</h3>
            <div className="kyc-review-docs">
              {detail!.documents.length === 0 && <p className="kyc-muted">Nenhum documento enviado.</p>}
              {detail!.documents.map(doc => (
                <article key={doc.id} className={`kyc-review-doc is-${doc.status}`}>
                  <header>
                    <b>{DOC_LABELS[doc.docType]?.title || doc.docType}</b>
                    <Badge tone={doc.status === 'approved' ? 'ok' : doc.status === 'rejected' ? 'bad' : 'info'}>{DOC_STATUS_LABELS[doc.status]}</Badge>
                  </header>
                  {doc.signedUrl && (
                    doc.mimeType === 'application/pdf'
                      ? <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer" className="kyc-review-doc-link"><FileText size={16} /> Abrir PDF</a>
                      : <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer" className="kyc-review-doc-thumb"><img src={doc.signedUrl} alt={doc.docType} /></a>
                  )}
                  <div className="kyc-review-doc-actions">
                    <Button size="sm" disabled={Boolean(busy)} onClick={() => void run(() => kycService.adminReviewDocument(doc.id, 'approved'), `doc-ok-${doc.id}`)}>Aprovar</Button>
                    <Button size="sm" variant="danger" disabled={Boolean(busy) || !reason.trim()}
                      onClick={() => void run(() => kycService.adminReviewDocument(doc.id, 'rejected', reason), `doc-no-${doc.id}`)}>Reprovar</Button>
                  </div>
                </article>
              ))}
            </div>

            <label className="kyc-review-reason">
              <span>Motivo (para reprovar ou pedir ajustes)</span>
              <textarea value={reason} onChange={event => setReason(event.target.value)} rows={3} maxLength={2000} />
            </label>

            {error && <StateMessage title="Atenção">{error}</StateMessage>}

            <div className="kyc-review-decision">
              <Button variant="primary" disabled={Boolean(busy)}
                onClick={() => void run(() => kycService.adminReviewProfile(userId, 'approved'), 'profile-ok')}>
                {busy === 'profile-ok' ? <Loader2 className="kyc-spin" size={16} /> : <CheckCircle2 size={16} />} Aprovar cadastro
              </Button>
              <Button disabled={Boolean(busy) || !reason.trim()}
                onClick={() => void run(() => kycService.adminReviewProfile(userId, 'needs_more_info', reason), 'profile-info')}>
                Pedir ajustes
              </Button>
              <Button variant="danger" disabled={Boolean(busy) || !reason.trim()}
                onClick={() => void run(() => kycService.adminReviewProfile(userId, 'rejected', reason), 'profile-no')}>
                Reprovar
              </Button>
            </div>
          </div>
        )}
    </Modal>
  )
}
