import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest'
const user='11111111-1111-4111-8111-111111111111',document='22222222-2222-4222-8222-222222222222'
let db:PGlite
beforeAll(async()=>{
 db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);
 create table public.kyc_profiles(user_id uuid primary key,status text,reviewed_at timestamptz);
 create table public.kyc_documents(id uuid primary key,user_id uuid,status text,reviewed_at timestamptz);
 insert into auth.users values('${user}');`)
 await db.exec(readFileSync('supabase/migrations/20261021045918_branded_kyc_email_outbox.sql','utf8'))
})
afterAll(async()=>{await db.close()})
beforeEach(async()=>{await db.exec(`truncate kyc_email_outbox,kyc_profiles,kyc_documents;insert into kyc_profiles values('${user}','pending',null);insert into kyc_documents values('${document}','${user}','pending',null);`)})
it('enfileira decisões do perfil e do documento sem repetir atualização sem mudança',async()=>{
 await db.exec(`update kyc_profiles set status='approved',reviewed_at=now();update kyc_profiles set status='approved';update kyc_documents set status='rejected',reviewed_at=now();`)
 const jobs=(await db.query<{target:string;decision:string}>('select target,decision from kyc_email_outbox order by target')).rows
 expect(jobs).toEqual([{target:'document',decision:'rejected'},{target:'profile',decision:'approved'}])
})
it('uma decisão revertida também reverte o aviso',async()=>{
 await db.exec(`begin;update kyc_profiles set status='approved',reviewed_at=now();rollback;`)
 expect((await db.query('select * from kyc_email_outbox')).rows).toHaveLength(0)
})
it('reserva o evento uma vez e recupera um worker interrompido',async()=>{
 await db.exec(`update kyc_profiles set status='needs_more_info',reviewed_at=now();`)
 expect((await db.query('select * from claim_kyc_emails(5)')).rows).toHaveLength(1)
 expect((await db.query('select * from claim_kyc_emails(5)')).rows).toHaveLength(0)
 await db.exec(`update kyc_email_outbox set available_at=now()-interval '1 second';`)
 expect((await db.query<{attempts:number}>('select * from claim_kyc_emails(5)')).rows[0].attempts).toBe(2)
})
it('não reenvia eventos enviados, antigos ou com tentativas esgotadas',async()=>{
 await db.exec(`update kyc_profiles set status='approved',reviewed_at=now();update kyc_email_outbox set attempts=8;`)
 expect((await db.query('select * from claim_kyc_emails(5)')).rows).toHaveLength(0)
 await db.exec(`update kyc_email_outbox set attempts=0,created_at=now()-interval '24 hours';`)
 expect((await db.query('select * from claim_kyc_emails(5)')).rows).toHaveLength(0)
 await db.exec(`update kyc_email_outbox set created_at=now(),status='sent';`)
 expect((await db.query('select * from claim_kyc_emails(5)')).rows).toHaveLength(0)
})
it('recusa leitura da fila e execução por clientes anônimos ou autenticados',async()=>{
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`)
  await expect(db.query('select * from kyc_email_outbox')).rejects.toThrow(/permission denied/)
  await expect(db.query('select * from claim_kyc_emails(5)')).rejects.toThrow(/permission denied/)
  await db.exec('reset role')
 }
})
