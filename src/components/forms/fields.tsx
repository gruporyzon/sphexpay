import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { maskCEP, maskCNPJ, maskCPF, maskCpfCnpj, maskDateBR, maskPhoneBR, maskUF } from '../../lib/masks'
import { BrazilFlag } from './BrazilFlag'
import './forms.css'

type BaseProps = {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  required?: boolean
  placeholder?: string
  name?: string
  invalid?: boolean
  hint?: string
  autoComplete?: string
}

function FieldShell({
  label, invalid, hint, disabled, adornment, children,
}: {
  label: string
  invalid?: boolean
  hint?: string
  disabled?: boolean
  adornment?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="spx-field">
      <span>{label}</span>
      <span className={cn('spx-field-box', invalid && 'is-invalid', disabled && 'is-disabled')}>
        {adornment}
        {children}
      </span>
      {invalid && hint ? <span className="spx-field-hint">{hint}</span> : null}
    </label>
  )
}

/** Campo de texto simples com o visual padrão de cadastro. */
export function TextField({
  label, value, onChange, disabled, required, placeholder, name, invalid, hint, autoComplete,
  type = 'text', inputMode,
}: BaseProps & { type?: string; inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'] }) {
  return (
    <FieldShell label={label} invalid={invalid} hint={hint} disabled={disabled}>
      <input
        type={type}
        value={value}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        name={name}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onChange={event => onChange(event.target.value)}
      />
    </FieldShell>
  )
}

export type MaskName = 'cpf' | 'cnpj' | 'cpfCnpj' | 'cep' | 'uf' | 'dateBR' | 'phoneBR'

const MASKS: Record<MaskName, (value: string) => string> = {
  cpf: maskCPF,
  cnpj: maskCNPJ,
  cpfCnpj: maskCpfCnpj,
  cep: maskCEP,
  uf: maskUF,
  dateBR: maskDateBR,
  phoneBR: maskPhoneBR,
}

const PLACEHOLDERS: Record<MaskName, string> = {
  cpf: '000.000.000-00',
  cnpj: '00.000.000/0000-00',
  cpfCnpj: '000.000.000-00',
  cep: '00000-000',
  uf: 'SP',
  dateBR: 'dd/mm/aaaa',
  phoneBR: '(11) 91234-5678',
}

/** Campo com máscara. O valor recebido no `onChange` já vem formatado. */
export function MaskedField({
  label, mask, value, onChange, disabled, required, placeholder, name, invalid, hint, autoComplete,
}: BaseProps & { mask: MaskName }) {
  const apply = MASKS[mask]
  return (
    <FieldShell label={label} invalid={invalid} hint={hint} disabled={disabled}>
      <input
        type="text"
        inputMode={mask === 'uf' ? 'text' : 'numeric'}
        value={value}
        disabled={disabled}
        required={required}
        placeholder={placeholder ?? PLACEHOLDERS[mask]}
        name={name}
        autoComplete={autoComplete}
        onChange={event => onChange(apply(event.target.value))}
      />
    </FieldShell>
  )
}

/** Telefone com a bandeira do país e o prefixo +55 no DDD. */
export function PhoneField({
  label, value, onChange, disabled, required, placeholder, name, invalid, hint,
}: BaseProps) {
  return (
    <FieldShell
      label={label}
      invalid={invalid}
      hint={hint}
      disabled={disabled}
      adornment={(
        <>
          <span className="spx-field-adorn"><BrazilFlag />+55</span>
          <span className="spx-field-divider" aria-hidden="true" />
        </>
      )}
    >
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={value}
        disabled={disabled}
        required={required}
        placeholder={placeholder ?? '(11) 91234-5678'}
        name={name}
        onChange={event => onChange(maskPhoneBR(event.target.value))}
      />
    </FieldShell>
  )
}
