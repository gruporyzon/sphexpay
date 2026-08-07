import type { FinancialTransaction } from '../../lib/dashboardFinance'
import { transactionStatusLabels } from './transactionStatus'

export function TransactionStatusBadge({ status, className = '' }: { status: FinancialTransaction['status']; className?: string }) {
  return <span className={`transaction-status-badge ${status} ${className}`.trim()}><i aria-hidden="true" />{transactionStatusLabels[status]}</span>
}
