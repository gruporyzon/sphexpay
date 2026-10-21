import { readFileSync } from 'node:fs'
import { describe,expect,it } from 'vitest'
import { escapeHtml,renderEmail,emailText } from '../../supabase/functions/_shared/emailLayout'
import { authTemplates,allAuthTemplates } from '../../scripts/build-email-templates.mjs'

const GMAIL_CLIP_BYTES=102*1024

describe('e-mails SphexPay',()=>{
 it.each(Object.keys(allAuthTemplates))('template de Auth %s está gerado, leve e com a identidade do gateway',name=>{
  const html=readFileSync(`supabase/templates/${name}.html`,'utf8')
  expect(html).toBe(renderEmail(allAuthTemplates[name].content))
  expect(Buffer.byteLength(html)).toBeLessThan(GMAIL_CLIP_BYTES/10)
  expect(html).toContain('https://www.sphexpay.com.br/brand/email-logo-white.png')
  expect(html).toContain('#0080ff')
  expect(html).toContain('Sphex<b style="font-weight:600">Pay</b>')
  if(name in authTemplates)expect(html).toContain(name==='reauthentication'?'{{ .Token }}':'{{ .ConfirmationURL }}')
  expect(readFileSync(`supabase/templates/${name}.txt`,'utf8')).toBe(emailText(html))
  const doc=new DOMParser().parseFromString(html,'text/html')
  expect(doc.querySelectorAll('h1')).toHaveLength(1)
  for(const element of [doc.documentElement,...doc.body.children]){expect(element.getAttribute('lang')).toBe('pt-BR');expect(element.getAttribute('dir')).toBe('ltr')}
  for(const a of doc.querySelectorAll('a')){expect(a.textContent?.trim()).toBeTruthy();expect(a.getAttribute('href')).toMatch(/^(https:\/\/|{{ \.ConfirmationURL }})/)}
  expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
 })

 it('mantém dados tabulares escapados e legíveis no texto',()=>{
  const html=renderEmail({preheader:'p',eyebrow:'Equipe',title:'Aviso',paragraphs:[],facts:[{label:'Nome',value:'<img src=x>'}],reason:'r'})
  expect(html).toContain('&lt;img src=x&gt;')
  expect(emailText(html)).toContain('Nome: <img src=x>')
 })

 it('mantém os assuntos em português e com a marca',()=>{
  for(const {subject} of Object.values(authTemplates))expect(subject).toMatch(/SphexPay/)
 })

 it('escapa dados do usuário antes de entrar no HTML',()=>{
  const name=escapeHtml('<img src=x onerror=alert(1)>Maria')
  const html=renderEmail({preheader:'p',eyebrow:'Boas-vindas',title:`Olá, ${name}.`,paragraphs:['Texto'],reason:'r'})
  expect(html).not.toContain('<img src=x')
  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;Maria')
 })
})
