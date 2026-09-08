import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe,expect,it } from 'vitest'

const config=JSON.parse(readFileSync(resolve(process.cwd(),'vercel.json'),'utf8')) as {
 headers:{source:string;headers:{key:string;value:string}[]}[]
}

const rule=(source:string)=>config.headers.find(entry=>entry.source===source)
const header=(source:string,key:string)=>rule(source)?.headers.find(item=>item.key.toLowerCase()===key.toLowerCase())?.value

describe('cabeçalhos de segurança da Vercel',()=>{
 it('aplica os cabeçalhos base a todas as rotas',()=>{
  expect(header('/(.*)','Strict-Transport-Security')).toContain('max-age=63072000')
  expect(header('/(.*)','X-Content-Type-Options')).toBe('nosniff')
  expect(header('/(.*)','X-Frame-Options')).toBe('DENY')
  expect(header('/(.*)','Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  expect(header('/(.*)','Cross-Origin-Opener-Policy')).toBe('same-origin')
 })
 it('define Permissions-Policy negando câmera, geolocalização e pagamento',()=>{
  const policy=header('/(.*)','Permissions-Policy')||''
  expect(policy).toContain('camera=()')
  expect(policy).toContain('geolocation=()')
  expect(policy).toContain('payment=()')
  expect(policy).toContain('microphone=(self)')
 })
 it('publica CSP em modo report-only com fontes restritas e Supabase liberado',()=>{
  const csp=header('/(.*)','Content-Security-Policy-Report-Only')||''
  expect(csp).toContain("default-src 'self'")
  expect(csp).toContain("frame-ancestors 'none'")
  expect(csp).toContain("object-src 'none'")
  expect(csp).toContain('https://*.supabase.co')
  expect(csp).toContain('wss://*.supabase.co')
  expect(csp).not.toContain('unsafe-eval')
 })
 it('impede cache e indexação das rotas de API',()=>{
  expect(header('/api/(.*)','Cache-Control')).toContain('no-store')
  expect(header('/api/(.*)','X-Robots-Tag')).toContain('noindex')
 })
})
