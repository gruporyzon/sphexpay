import { describe,expect,it } from 'vitest'
import { voiceService } from '../services/voiceService'

const voice=(voiceURI:string,name:string,lang='pt-BR')=>({voiceURI,name,lang,localService:true,default:false} as SpeechSynthesisVoice)

describe('voiceService',()=>{
 it('seleciona voiceURI diferentes para perfis feminino e masculino',()=>{
  const pair=voiceService.pair([voice('pt-female','Luciana'),voice('pt-male','Antonio')])
  expect(pair.female?.voiceURI).toBe('pt-female')
  expect(pair.male?.voiceURI).toBe('pt-male')
  expect(pair.female?.voiceURI).not.toBe(pair.male?.voiceURI)
 })

 it('remove vozes duplicadas pelo voiceURI',()=>{
  const voices=[voice('same-uri','Luciana'),voice('same-uri','Luciana duplicada'),voice('male-uri','Antonio')]
  expect(voiceService.catalog(voices)).toHaveLength(2)
 })

 it('não inventa uma voz masculina quando só existe uma voz em português',()=>{
  const pair=voiceService.pair([voice('only-pt','Luciana')])
  expect(pair.female?.voiceURI).toBe('only-pt')
  expect(pair.male).toBeNull()
  expect(pair.message).toContain('somente uma voz em português')
 })

 it('prioriza pt-BR e usa pt-PT como fallback',()=>{
  const pair=voiceService.pair([voice('english','Samantha','en-US'),voice('portugal','Joana','pt-PT'),voice('brazil','Luciana','pt-BR')])
  expect(pair.device?.voiceURI).toBe('brazil')
 })
})
