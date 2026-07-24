import { beforeEach,describe,expect,it,vi } from 'vitest'
import { act,renderHook } from '@testing-library/react'
import { defaultGeneratorConfig,formatGeneratorValue,generatorBody,intervalMilliseconds,loadGeneratorData,saveGeneratorData,validateGenerator,variedValue } from '../lib/notificationGenerator'
import { useNotificationGenerator } from '../hooks/useNotificationGenerator'

describe('motor do gerador inteligente',()=>{
 beforeEach(()=>localStorage.clear())

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

 it('pausa, retoma e conclui uma sequência sem duplicar timers',async()=>{
  vi.useFakeTimers()
  const {result,unmount}=renderHook(()=>useNotificationGenerator()),config={...defaultGeneratorConfig,mode:'batch' as const,quantity:3,intervalValue:1}
  act(()=>{result.current.begin(config)})
  await act(async()=>{await Promise.resolve()})
  expect(result.current.sent).toBe(1)
  act(()=>result.current.pause())
  await act(async()=>{await vi.advanceTimersByTimeAsync(2500)})
  expect(result.current.sent).toBe(1)
  act(()=>result.current.resume())
  await act(async()=>{await Promise.resolve()})
  expect(result.current.sent).toBe(2)
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000)})
  expect(result.current.sent).toBe(3)
  expect(result.current.status).toBe('completed')
  unmount()
  expect(vi.getTimerCount()).toBeLessThanOrEqual(1)
  vi.clearAllTimers()
  vi.useRealTimers()
 })
})
