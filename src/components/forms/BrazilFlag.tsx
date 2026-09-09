// Bandeira do Brasil — usada no prefixo de DDD dos campos de telefone.
export function BrazilFlag({ className = 'spx-field-flag' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 20" role="img" aria-label="Brasil" focusable="false">
      <rect width="28" height="20" fill="#009b3a" />
      <path d="M14 2.2 25.4 10 14 17.8 2.6 10Z" fill="#fedf00" />
      <circle cx="14" cy="10" r="4.1" fill="#002776" />
    </svg>
  )
}
