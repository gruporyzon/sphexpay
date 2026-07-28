import { describe,expect,it } from 'vitest'
import { amountToMinor,formatManualNotification,manualNotificationTemplates,normalizeBrazilianAmount,type ManualNotificationDraft } from '../lib/manualNotification'

const draft=(values:Partial<ManualNotificationDraft>={}):ManualNotificationDraft=>({
 notificationType:'sale_approved',
 title:manualNotificationTemplates.sale_approved.title,
 body:manualNotificationTemplates.sale_approved.body,
 value:'128,50',
 valueKind:'commission',
 currency:'BRL',
 product:'Plano Premium',
 customer:'Ronald',
 method:'Pix',
 route:'/app/transacoes',
 icon:'/icons/sphexpay-app-192.png',
 showTime:true,
 ...values
})

describe('gerador manual de notificações',()=>{
 it('substitui variáveis disponíveis e formata BRL sem conversão',()=>{
  const result=formatManualNotification(draft())
  expect(result.body).toContain('Plano Premium')
  expect(result.body).toContain('R$')
  expect(result.body).toContain('128,50')
  expect(result.missing).toEqual([])
 })

 it('respeita USD e EUR sem inventar câmbio',()=>{
  expect(formatManualNotification(draft({currency:'USD',value:'10'})).body).toContain('$10.00')
  expect(formatManualNotification(draft({currency:'EUR',value:'10'})).body).toContain('10,00')
 })

 it('informa campos ausentes e remove variáveis quebradas da prévia',()=>{
  const result=formatManualNotification(draft({product:'',value:'',body:'{produto} • {valor}'}))
  expect(result.missing).toEqual(expect.arrayContaining(['produto','valor']))
  expect(result.body).not.toMatch(/[{}]/)
 })

 it('valida título, mensagem e rota autenticada',()=>{
  const result=formatManualNotification(draft({title:'',body:'',route:'/externa'}))
  expect(result.missing).toEqual(expect.arrayContaining(['título','mensagem','rota de destino']))
 })

 it('limita o resultado aos tamanhos seguros',()=>{
  const result=formatManualNotification(draft({title:'T'.repeat(100),body:'M'.repeat(220)}))
  expect(result.title).toHaveLength(80)
  expect(result.body).toHaveLength(180)
 })

 it('normaliza entrada brasileira e converte o valor somente para centavos',()=>{
  expect(normalizeBrazilianAmount('R$ 10.000,009')).toBe('10.000,00')
  expect(normalizeBrazilianAmount('-97,00')).toBe('97,00')
  expect(amountToMinor('1.000,00')).toBe(100000)
  expect(amountToMinor('-1,00')).toBeNull()
 })
})
