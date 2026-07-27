import { beforeEach,describe,expect,it,vi } from 'vitest'

describe('identidade persistente do dispositivo',()=>{
 beforeEach(()=>{
  localStorage.clear()
  vi.resetModules()
  vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false})))
  Object.defineProperty(window,'indexedDB',{configurable:true,value:undefined})
 })

 it('cria um device_id UUID e o mantém no armazenamento local',async()=>{
  const {getOrCreateDeviceIdentity}=await import('../services/deviceIdentityService')
  const first=await getOrCreateDeviceIdentity(),second=await getOrCreateDeviceIdentity()
  expect(first.deviceId).toMatch(/^[0-9a-f-]{36}$/i)
  expect(second.deviceId).toBe(first.deviceId)
  expect(localStorage.getItem('sphexpay_device_id_v1')).toBe(first.deviceId)
 })

 it('recupera o mesmo device_id depois de recarregar o módulo',async()=>{
  localStorage.setItem('sphexpay_device_id_v1','22222222-2222-4222-8222-222222222222')
  const {getOrCreateDeviceIdentity}=await import('../services/deviceIdentityService')
  expect((await getOrCreateDeviceIdentity()).deviceId).toBe('22222222-2222-4222-8222-222222222222')
 })

 it('nomeia Chrome no macOS sem afirmar modelo físico',async()=>{
  const {describeDevice}=await import('../services/deviceIdentityService')
  expect(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit Chrome/126 Safari/537.36',false)).toMatchObject({automaticName:'Chrome no macOS',browser:'Chrome',operatingSystem:'macOS',platform:'desktop',displayMode:'browser'})
  expect(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit Chrome/126 Safari/537.36',true).automaticName).toBe('Aplicativo SphexPay no macOS')
 })
})
