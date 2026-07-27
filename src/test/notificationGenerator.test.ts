import { beforeEach,describe,expect,it,vi } from 'vitest'
import { act,renderHook,waitFor } from '@testing-library/react'
import { defaultGeneratorConfig,formatGeneratorValue,generatorBody,intervalMilliseconds,loadGeneratorData,saveGeneratorData,validateGenerator,variedValue } from '../lib/notificationGenerator'
import { useNotificationGenerator } from '../hooks/useNotificationGenerator'
import { pushSubscriptionService } from '../services/pushSubscriptionService'
vi.mock('../lib/supabase',()=>({supabase:{functions:{invoke:vi.fn(async()=>({error:null}))}}}))
const mockDevice={id:'11111111-1111-4111-8111-111111111111',deviceId:'22222222-2222-4222-8222-222222222222',name:'Mac',platform:'desktop',browser:'Safari',operatingSystem:'macOS',type:'Navegador',status:'Conectado' as const,enabled:true,lastSeenAt:new Date().toISOString(),isCurrentDevice:true}
vi.mock('../services/pushSubscriptionService',()=>({pushSubscriptionService:{current:vi.fn(async()=>({})),devices:vi.fn(async()=>[mockDevice]),send:vi.fn(async()=>({ok:true,message:'Notificação enviada ao dispositivo.',sent:1})),sendGenerated:vi.fn(async()=>({ok:true,message:'Notificação enviada ao dispositivo.',sent:1})),sendTest:vi.fn(async()=>({ok:true,message:'Notificação enviada ao dispositivo.',sent:1}))}}))

describe('motor do gerador inteligente',()=>{
 beforeEach(()=>{localStorage.clear();vi.mocked(pushSubscriptionService.devices).mockResolvedValue([mockDevice])})

 it('converte intervalos sem permitir ciclos abaixo de um segundo',()=>{
  expect(intervalMilliseconds({...defaultGeneratorConfig,intervalValue:.1})).toBe(1000)
  expect(intervalMilliseconds({...defaultGeneratorConfig,intervalValue:5,intervalUnit:'minutes'})).toBe(300000)
  expect(intervalMilliseconds({...defaultGeneratorConfig,intervalValue:2,intervalUnit:'hours'})).toBe(7200000)
 })

 it('valida quantidade, tipos e agenda futura',()=>{
  expect(validateGenerator({...defaultGeneratorConfig,quantity:101})).toMatch(/entre 1 e 100/)
  expect(validateGenerator({...defaultGeneratorConfig,types:[]})).toMatch(/pelo menos um tipo/)
  expect(validateGenerator({...defaultGeneratorConfig,mode:'scheduled',startAt:'2020-01-01T10:00'})).toMatch(/data futura/)
  expect(validateGenerator(defaultGeneratorConfig)).toBe('')
 })

 it('formata valores e texto personalizado corretamente',()=>{
  expect(formatGeneratorValue(1000,'BRL')).toBe('R$ 1.000,00')
  expect(formatGeneratorValue(1000,'USD')).toBe('US$1,000.00')
  expect(formatGeneratorValue(1000,'EUR')).toBe('€ 1.000,00')
 expect(generatorBody({...defaultGeneratorConfig,valueLabel:'Lucro',value:12.5})).toBe('Lucro: R$ 12,50')
 expect(generatorBody({...defaultGeneratorConfig,customBody:'Texto controlado'})).toBe('Texto controlado')
 expect(generatorBody({...defaultGeneratorConfig,customBody:'from SphexPay\nSua comissão: R$ 17,65'})).toBe('Sua comissão: R$ 17,65')
 })

 it('gera variações dentro da faixa e persiste presets e histórico',()=>{
  vi.spyOn(Math,'random').mockReturnValue(.5)
  expect(variedValue({...defaultGeneratorConfig,variation:true,minValue:10,maxValue:20})).toBe(15)
  const preset={id:'preset-1',name:'Campanha',createdAt:new Date().toISOString(),config:defaultGeneratorConfig}
 saveGeneratorData(defaultGeneratorConfig,[],[preset])
 expect(loadGeneratorData().presets[0].name).toBe('Campanha')
 })

 it('sanitiza configurações e presets antigos ao carregar',()=>{
  localStorage.setItem('sphexpay_notification_generator_v1',JSON.stringify({
   config:{...defaultGeneratorConfig,customBody:'from SphexPay\nSua comissão: R$ 17,65'},
   presets:[{id:'legacy',name:'Legado',createdAt:new Date().toISOString(),config:{...defaultGeneratorConfig,customBody:'enviado por SphexPay\nValor: € 15,71'}}],
  }))
  const saved=loadGeneratorData()
  expect(saved.config.customBody).toBe('Sua comissão: R$ 17,65')
  expect(saved.presets[0].config.customBody).toBe('Valor: € 15,71')
 })

 it('envia o conteúdo do gerador pelo backend real conectado',async()=>{
  const {result,unmount}=renderHook(()=>useNotificationGenerator())
  await act(async()=>{await result.current.begin({...defaultGeneratorConfig,mode:'single',quantity:1})})
  await waitFor(()=>expect(result.current.status).toBe('completed'))
  expect(result.current.sent).toBe(1)
  expect(result.current.message).toBe('Sequência concluída.')
  unmount()
 })
 it('bloqueia o gerador quando não há dispositivo ativo',async()=>{
  vi.mocked(pushSubscriptionService.devices).mockResolvedValue([])
  const {result,unmount}=renderHook(()=>useNotificationGenerator())
  await act(async()=>{expect(await result.current.begin(defaultGeneratorConfig)).toBe(false)})
  expect(result.current.message).toContain('NO_ACTIVE_SUBSCRIPTIONS')
  unmount()
 })
})
