import type { FinancialTransaction } from '../../lib/dashboardFinance'

export const transactionStatusLabels: Record<FinancialTransaction['status'], string> = {
  approved: 'Aprovada',
  pending: 'Pendente',
  declined: 'Recusada',
  refunded: 'Reembolsada',
  chargeback: 'Chargeback',
}
