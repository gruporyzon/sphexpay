import { describe,expect,it } from 'vitest'
import { amountToMinor,applyAiSuggestion,formatEstimatedDuration,formatManualNotification,intervalToMilliseconds,localNotificationVariations,manualNotificationTemplates,normalizeBrazilianAmount,notificationContent,notificationVariables,validateSequence,type ManualNotificationDraft } from '../lib/manualNotification'

const draft=(values:Partial<ManualNotificationDraft>={}):ManualNotificationDraft=>({
 notificationType:'sale_approved',
 title:manualNotificationTemplates.sale_approved.title,
 body:manualNotificationTemplates.sale_approved.body,
 value:'128,50',
 valueKind:'commission',
 currency:'BRL',
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
  expect(result.body).not.toContain('produto')
  expect(result.body).toContain('R$')
  expect(result.body).toContain('128,50')
  expect(result.missing).toEqual([])
 })

 it('respeita USD e EUR sem inventar câmbio',()=>{
  expect(formatManualNotification(draft({currency:'USD',value:'10'})).body).toContain('$10.00')
  expect(formatManualNotification(draft({currency:'EUR',value:'10'})).body).toContain('10,00')
 })

 it('remove produto do contrato manual e informa variáveis ausentes',()=>{
  const result=formatManualNotification(draft({value:'',body:'{valor}'}))
  expect(notificationVariables).not.toContain('{produto}')
  expect(Object.values(manualNotificationTemplates).every(template=>!template.title.includes('{produto}')&&!template.body.includes('{produto}'))).toBe(true)
  expect(result.missing).toContain('valor')
  expect(result.body).not.toMatch(/[{}]/)
 })

 it('valida título, mensagem e rota autenticada',()=>{
  const result=formatManualNotification(draft({title:'',body:'',route:'/externa'}))
  expect(result.missing).toEqual(expect.arrayContaining(['título','mensagem','rota de destino']))
 })

 it('limita o resultado aos tamanhos seguros',()=>{
  const result=formatManualNotification(draft({title:'T'.repeat(100),body:'M'.repeat(220)}))
  expect(result.title).toHaveLength(60)
  expect(result.body).toHaveLength(160)
 })

 it('normaliza entrada brasileira e converte o valor somente para centavos',()=>{
  expect(normalizeBrazilianAmount('R$ 10.000,009')).toBe('10.000,00')
  expect(normalizeBrazilianAmount('-97,00')).toBe('97,00')
  expect(amountToMinor('1.000,00')).toBe(100000)
  expect(amountToMinor('-1,00')).toBeNull()
 })

 it('aplica sugestão de IA apenas ao texto da notificação',()=>{
  const original=draft({value:'297,00'})
  const next=applyAiSuggestion(original,{title:'Pagamento confirmado',body:'Pagamento de R$ 297,00 confirmado.'})
  expect(next).toMatchObject({title:'Pagamento confirmado',body:'Pagamento de R$ 297,00 confirmado.',value:'297,00'})
  expect(original.title).toBe('Venda aprovada!')
 })

 it('converte segundos, minutos e horas em um único helper',()=>{
  expect(intervalToMilliseconds(5,'seconds')).toBe(5000)
  expect(intervalToMilliseconds(2,'minutes')).toBe(120000)
  expect(intervalToMilliseconds(1,'hours')).toBe(3600000)
 })

 it('valida quantidade e limites seguros de intervalo',()=>{
  expect(validateSequence(0,5,'seconds')).toMatch(/quantidade/i)
  expect(validateSequence(-1,5,'seconds')).toMatch(/quantidade/i)
  expect(validateSequence(1.5,5,'seconds')).toMatch(/inteiro/i)
  expect(validateSequence(101,5,'seconds')).toMatch(/100/)
  expect(validateSequence(5,4,'seconds')).toMatch(/5/)
  expect(validateSequence(5,1,'minutes')).toBe('')
  expect(validateSequence(5,168,'hours')).toBe('')
 })

 it('calcula a duração estimada a partir dos intervalos',()=>{
  expect(formatEstimatedDuration(0)).toBe('Envio imediato.')
  expect(formatEstimatedDuration(intervalToMilliseconds(30,'seconds')*9)).toBe('Duração estimada: 4 minutos e 30 segundos.')
  expect(formatEstimatedDuration(intervalToMilliseconds(2,'hours')*4)).toBe('Duração estimada: 8 horas.')
 })

 it('cria variações locais sem produto e sem repetição consecutiva',()=>{
  const variations=localNotificationVariations('sale_approved','R$ 197,00')
  expect(variations).toHaveLength(3)
  expect(new Set(variations.map(item=>`${item.title}|${item.body}`)).size).toBe(3)
  expect(variations.every(item=>!item.body.toLowerCase().includes('produto'))).toBe(true)
 })

 it('aplica comissão, valor da venda, valor recebido ou nenhum valor',()=>{
  expect(notificationContent('sale_approved','commission').body).toBe('Sua comissão: {valor}')
  expect(notificationContent('sale_approved','sale').body).toBe('Valor da venda: {valor}')
  expect(notificationContent('sale_approved','received').body).toBe('Valor recebido: {valor}')
  expect(notificationContent('sale_approved','none').body).not.toContain('{valor}')
 })
})
