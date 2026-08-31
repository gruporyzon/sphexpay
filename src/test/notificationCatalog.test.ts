import { describe,expect,it } from 'vitest'
import { formatCommission,notificationTitles,notificationRoutes } from '../lib/notificationCatalog'

describe('catálogo de notificações comerciais',()=>{
 it('mantém os títulos e destinos oficiais',()=>{
  expect(notificationTitles.sale_approved).toBe('Venda aprovada!')
  expect(notificationTitles.payment_refused).toBe('Pagamento recusado!')
  expect(notificationRoutes.withdrawal_sent).toBe('/app/financeiro/saques')
 })

 it('formata comissão em BRL, USD e EUR sem converter valores',()=>{
  expect(formatCommission(3.83,'BRL')).toBe('Sua comissão: R$ 3,83')
  expect(formatCommission(3.83,'USD')).toBe('Sua comissão: US$3.83')
  expect(formatCommission(3.83,'EUR')).toBe('Sua comissão: € 3,83')
 })

 it('usa fallback seguro quando a comissão não existe',()=>{
  expect(formatCommission(null,'BRL')).toBe('Sua comissão: —')
 })
})
