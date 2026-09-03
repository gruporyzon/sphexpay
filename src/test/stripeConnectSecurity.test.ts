import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'

const read=(path:string)=>readFileSync(path,'utf8')
describe('segurança da fundação Stripe Connect',()=>{
 it('mantém a secret exclusivamente no cliente server-side',()=>{
  const frontend=[read('src/services/stripeConnectService.ts'),read('src/components/finance/StripeConnectCard.tsx')].join('\n')
  expect(frontend).not.toContain('STRIPE_SECRET_KEY');expect(frontend).not.toContain('VITE_STRIPE_SECRET_KEY')
  expect(read('server/stripe/client.js')).toContain('process.env.STRIPE_SECRET_KEY')
 })
 it('protege ownership e escrita na migration',()=>{
  const migration=read('supabase/migrations/20260903110000_stripe_connect_foundation.sql')
  expect(migration).toContain('unique (user_id)');expect(migration).toContain('unique (stripe_account_id)')
  expect(migration).toContain('auth.uid() = user_id');expect(migration).toContain('revoke all')
 })
})
