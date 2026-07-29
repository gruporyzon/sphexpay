import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe,expect,it } from 'vitest'

const read=(path:string)=>readFileSync(resolve(process.cwd(),path),'utf8')
const auth=read('src/services/authService.ts'),callback=read('src/pages/auth/AuthCallbackPage.tsx'),supabase=read('src/lib/supabase.ts'),html=read('index.html'),landing=read('src/pages/public/LandingPage.tsx'),css=read('src/public.css')

describe('segurança, SEO e responsividade pública',()=>{
 it('preserva os redirects Supabase existentes',()=>{
  expect(auth).toContain("`${window.location.origin}/auth/callback`")
  expect(auth).toContain("`${window.location.origin}/nova-senha`")
  expect(callback).toContain('exchangeCodeForSession')
  expect(callback).toContain("value?.startsWith('/app')")
 })
 it('reutiliza somente a chave publicável e não inclui service role no frontend público',()=>{
  expect(supabase).toContain('VITE_SUPABASE_PUBLISHABLE_KEY')
  expect(supabase).not.toMatch(/SERVICE_ROLE|SMTP|PRIVATE_KEY/)
  expect([landing,css,html].join('\n')).not.toMatch(/kingpay/i)
 })
 it('possui metadados essenciais e arquivos indexáveis',()=>{
  expect(html).toContain('rel="canonical"')
  expect(html).toContain('property="og:title"')
  expect(html).toContain('name="twitter:card"')
  expect(read('public/robots.txt')).toContain('sitemap.xml')
  expect(read('public/sitemap.xml')).toContain('https://sphexpay.vercel.app/')
 })
 it('cobre safe areas, áreas de toque, redução de movimento e larguras críticas',()=>{
  expect(css).toContain('env(safe-area-inset-top)')
  expect(css).toContain('min-height:44px')
  expect(css).toContain('@media(max-width:359px)')
  expect(css).toContain('@media(max-width:680px)')
  expect(css).toContain('@media(max-width:900px)')
  expect(css).toContain('@media(prefers-reduced-motion:reduce)')
  expect(css).toContain('overflow-x:clip')
 })
})
