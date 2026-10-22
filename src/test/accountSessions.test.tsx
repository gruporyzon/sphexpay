import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { render,screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll,afterEach,beforeAll,describe,expect,it,vi } from 'vitest'
import { SessionsCard } from '../components/settings/AccountCards'
import { accountService,describeDevice } from '../services/accountService'

const me='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222'
const current='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',phone='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',foreign='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
let db:PGlite
beforeAll(async()=>{
 db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create type auth.aal_level as enum('aal1','aal2','aal3');
 create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),updated_at timestamptz,refreshed_at timestamp,not_after timestamptz,user_agent text,ip inet,aal auth.aal_level);
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('session_id',nullif(current_setting('test.session',true),'')) $$;`)
 await db.exec(readFileSync('supabase/migrations/20261022090000_account_sessions.sql','utf8'))
 await db.query(`insert into auth.sessions(id,user_id,user_agent,ip,aal) values($1,$4,'Mozilla/5.0 (Macintosh) Chrome/120','10.0.0.1','aal2'),($2,$4,'Mozilla/5.0 (iPhone) Safari/605','10.0.0.2','aal1'),($3,$5,'x','10.0.0.3','aal1')`,[current,phone,foreign,me,other])
},30000)
afterAll(async()=>{await db?.close()})
afterEach(()=>vi.restoreAllMocks())
const as=async<T,>(sql:string,params:unknown[]=[])=>{await db.exec(`select set_config('test.uid','${me}',false);select set_config('test.session','${current}',false)`);try{return(await db.query<T>(sql,params)).rows}finally{await db.exec(`select set_config('test.uid','',false);select set_config('test.session','',false)`)}}

describe('aparelhos conectados',()=>{
 it('lista só as sessões do próprio usuário, com a atual primeiro',async()=>{
  await expect(db.query('select * from my_sessions()')).rejects.toThrow(/AUTH_REQUIRED/)
  const rows=await as<{id:string;current:boolean;ip:string}>('select * from my_sessions()')
  expect(rows.map(row=>row.id)).toEqual([current,phone]);expect(rows[0].current).toBe(true);expect(rows[1].ip).toBe('10.0.0.2')
 })
 it('descreve o aparelho pelo navegador e sistema',()=>{
  expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Version/17.0 Safari/605.1')).toBe('Safari · iPhone/iPad')
  expect(describeDevice('Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537 Edg/120')).toBe('Edge · Windows')
  expect(describeDevice('')).toBe('Aparelho')
 })
 it('tela mostra a sessão atual e sai de todas as outras',async()=>{
  vi.spyOn(accountService,'sessions').mockResolvedValue([{id:'s1',createdAt:'2026-10-20T10:00:00Z',lastSeenAt:'2026-10-22T10:00:00Z',userAgent:'Mozilla/5.0 (Macintosh) Chrome/120',ip:'10.0.0.1',aal:'aal2',current:true},{id:'s2',createdAt:'2026-10-21T10:00:00Z',lastSeenAt:'2026-10-21T12:00:00Z',userAgent:'Mozilla/5.0 (iPhone) Safari/605',ip:'10.0.0.2',aal:'aal1',current:false}])
  const others=vi.spyOn(accountService,'signOutOthers').mockResolvedValue(undefined),user=userEvent.setup()
  render(<SessionsCard/>)
  expect(await screen.findByText('Chrome · Mac')).toBeInTheDocument()
  expect(screen.getByText('Atual')).toBeInTheDocument();expect(screen.getByText('Safari · iPhone/iPad')).toBeInTheDocument()
  await user.click(screen.getByRole('button',{name:/Sair de todos os outros/}));expect(others).toHaveBeenCalled()
 })
})
