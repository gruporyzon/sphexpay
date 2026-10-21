import {describe,it,expect,vi} from 'vitest'
import {sendEmail} from '../../supabase/functions/_shared/sendEmail'
import {kycEmail} from '../../supabase/functions/_shared/kycEmail'

const input={apiKey:'test-key',from:'SphexPay <avisos@example.invalid>',to:['merchant@example.invalid'],subject:'Resultado\r\nSeguro',html:'<p>Resultado</p>',text:'Resultado',idempotencyKey:'kyc-review/test-event'}
describe('entrega transacional',()=>{
 it('envia HTML e texto com chave idempotente e assunto sem quebra',async()=>{
  const request=vi.fn().mockResolvedValue(new Response('{}',{status:200}))
  expect(await sendEmail(input,request)).toEqual({ok:true,retryable:false})
  const [,options]=request.mock.calls[0]
  expect(options.headers['Idempotency-Key']).toBe(input.idempotencyKey)
  expect(JSON.parse(options.body)).toMatchObject({text:'Resultado',html:'<p>Resultado</p>',subject:'Resultado Seguro'})
  expect(options.signal).toBeDefined()
 })
 it.each([429,500,503])('preserva uma falha temporária %s para retentativa',async status=>{
  expect(await sendEmail(input,vi.fn().mockResolvedValue(new Response('{}',{status})))).toEqual({ok:false,retryable:true})
 })
 it('não repete erro permanente do provedor',async()=>{
  expect(await sendEmail(input,vi.fn().mockResolvedValue(new Response('{}',{status:422})))).toEqual({ok:false,retryable:false})
 })
 it('trata queda de rede sem expor a chave e sem descartar a retentativa',async()=>{
  expect(await sendEmail(input,vi.fn().mockRejectedValue(new Error('network')))).toEqual({ok:false,retryable:true})
 })
 it('não envia sem configuração ou destinatário',async()=>{
  const request=vi.fn()
  await sendEmail({...input,apiKey:''},request);await sendEmail({...input,to:[]},request)
  expect(request).not.toHaveBeenCalled()
 })
})
describe('resultado da verificação',()=>{
 it.each(['approved','rejected','needs_more_info'] as const)('cadastro %s usa o painel autenticado e versão em texto',decision=>{
  const email=kycEmail({target:'profile',decision})
  expect(email.html).toContain('https://www.sphexpay.com.br/app/verificacao')
  expect(email.text).toContain(email.content.title)
  expect(email.subject).toContain('SphexPay')
  expect(email.html).not.toMatch(/storage\/v1|signedUrl|CPF|CNPJ/)
 })
 it('aprovação de documento não promete aprovação integral ou pagamentos liberados',()=>{
  const email=kycEmail({target:'document',decision:'approved'})
  expect(email.text).toContain('não significa que toda a conta já foi aprovada')
  expect(email.text).not.toContain('recebimentos liberados')
 })
 it('rejeição mantém o motivo e os documentos no painel',()=>{
  expect(kycEmail({target:'document',decision:'rejected'}).text).toContain('consultar o motivo')
 })
 it('recusa decisão inválida para documento',()=>{
  expect(()=>kycEmail({target:'document',decision:'needs_more_info'})).toThrow('INVALID_DOCUMENT_DECISION')
 })
})
