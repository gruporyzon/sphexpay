// Máscaras de campos de cadastro (CPF, CNPJ, telefone, CEP, UF, data).
//
// Todas as funções são puras e "à prova de digitação": recebem qualquer texto,
// extraem os dígitos e devolvem o valor formatado até onde o usuário digitou.
// A normalização para persistência (só dígitos) fica em `unmask`.

export const onlyDigits = (value: string): string => (value || '').replace(/\D+/g, '')

/** Remove tudo que não é dígito — use antes de enviar ao banco. */
export const unmask = onlyDigits

export function maskCPF(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  let out = d.slice(0, 3)
  if (d.length > 3) out += `.${d.slice(3, 6)}`
  if (d.length > 6) out += `.${d.slice(6, 9)}`
  if (d.length > 9) out += `-${d.slice(9, 11)}`
  return out
}

export function maskCNPJ(value: string): string {
  const d = onlyDigits(value).slice(0, 14)
  let out = d.slice(0, 2)
  if (d.length > 2) out += `.${d.slice(2, 5)}`
  if (d.length > 5) out += `.${d.slice(5, 8)}`
  if (d.length > 8) out += `/${d.slice(8, 12)}`
  if (d.length > 12) out += `-${d.slice(12, 14)}`
  return out
}

/** CPF enquanto tiver até 11 dígitos, CNPJ a partir daí. */
export function maskCpfCnpj(value: string): string {
  return onlyDigits(value).length > 11 ? maskCNPJ(value) : maskCPF(value)
}

export function maskCEP(value: string): string {
  const d = onlyDigits(value).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/** Telefone brasileiro: (11) 91234-5678 (celular) ou (11) 1234-5678 (fixo). */
export function maskPhoneBR(value: string): string {
  let raw = onlyDigits(value)
  if (raw.length > 11 && raw.startsWith('55')) raw = raw.slice(2) // DDI +55 colado
  const d = raw.slice(0, 11)
  if (!d) return ''
  if (d.length <= 2) return `(${d}`
  const area = d.slice(0, 2)
  const rest = d.slice(2)
  // Celular tem 9 dígitos e começa com 9; fixo tem 8. Enquanto não dá para
  // saber, o primeiro dígito ('9') decide o ponto de quebra.
  const isMobile = rest.length > 8 || rest.startsWith('9')
  const cut = isMobile ? 5 : 4
  if (rest.length <= cut) return `(${area}) ${rest}`
  return `(${area}) ${rest.slice(0, cut)}-${rest.slice(cut)}`
}

/** Sigla de estado: 2 letras maiúsculas. */
export function maskUF(value: string): string {
  return (value || '').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2)
}

/** Data no formato brasileiro dd/mm/aaaa. */
export function maskDateBR(value: string): string {
  const d = onlyDigits(value).slice(0, 8)
  let out = d.slice(0, 2)
  if (d.length > 2) out += `/${d.slice(2, 4)}`
  if (d.length > 4) out += `/${d.slice(4, 8)}`
  return out
}

// -------------------------------------------------------------- validações

const allEqual = (d: string) => d.split('').every(char => char === d[0])

export function isValidCPF(value: string): boolean {
  const d = onlyDigits(value)
  if (d.length !== 11 || allEqual(d)) return false
  const check = (slice: number) => {
    let sum = 0
    for (let i = 0; i < slice; i++) sum += Number(d[i]) * (slice + 1 - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return check(9) === Number(d[9]) && check(10) === Number(d[10])
}

export function isValidCNPJ(value: string): boolean {
  const d = onlyDigits(value)
  if (d.length !== 14 || allEqual(d)) return false
  const check = (slice: number) => {
    const weights = slice === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let sum = 0
    for (let i = 0; i < slice; i++) sum += Number(d[i]) * weights[i]
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }
  return check(12) === Number(d[12]) && check(13) === Number(d[13])
}

/** ISO (yyyy-mm-dd) -> brasileiro (dd/mm/aaaa). */
export function isoToDateBR(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return match ? `${match[3]}/${match[2]}/${match[1]}` : ''
}

/** Brasileiro (dd/mm/aaaa) -> ISO (yyyy-mm-dd); '' se incompleto/ inválido. */
export function dateBRToISO(value: string): string {
  const d = onlyDigits(value)
  if (d.length !== 8) return ''
  const day = d.slice(0, 2)
  const month = d.slice(2, 4)
  const year = d.slice(4, 8)
  const date = new Date(`${year}-${month}-${day}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  if (date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)) return ''
  return `${year}-${month}-${day}`
}
