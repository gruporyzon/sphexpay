import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { kycService } from './kycService'
import { STATUS_LABELS, type KycStatus } from './types'
import './kyc.css'

const MESSAGES: Partial<Record<KycStatus, string>> = {
  draft: 'Envie seus documentos para liberar a operação.',
  pending: 'Seu cadastro está em análise pelo time de compliance.',
  rejected: 'Seu cadastro foi reprovado. Ajuste os dados e reenvie.',
  needs_more_info: 'O time de verificação solicitou ajustes no seu cadastro.',
}

export function KycStatusNotice() {
  const { user } = useAuth()
  const [status, setStatus] = useState<KycStatus | 'none' | null>(null)

  useEffect(() => {
    if (!user?.id) return
    let active = true
    kycService.overview(user.id)
      .then(overview => { if (active) setStatus(overview.profile?.status ?? 'none') })
      .catch(() => { if (active) setStatus(null) })
    return () => { active = false }
  }, [user?.id])

  if (!status || status === 'approved') return null
  const key: KycStatus = status === 'none' ? 'draft' : status
  const tone = key === 'rejected' || key === 'needs_more_info' ? 'bad' : 'info'

  return (
    <Link to="/app/verificacao" className={`kyc-notice tone-${tone}`}>
      <span className="kyc-notice-icon">{tone === 'bad' ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}</span>
      <span className="kyc-notice-text">
        <b>Verificação: {STATUS_LABELS[key]}</b>
        <small>{MESSAGES[key]}</small>
      </span>
      <ArrowRight size={16} />
    </Link>
  )
}
