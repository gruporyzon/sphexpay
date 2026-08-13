import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const app=fs.readFileSync('src/App.tsx','utf8'),layout=fs.readFileSync('src/components/Layout.tsx','utf8'),service=fs.readFileSync('src/features/social/socialService.ts','utf8'),page=fs.readFileSync('src/features/social/SocialPage.tsx','utf8'),sql=fs.readFileSync('supabase/migrations/20260812180000_social_v1.sql','utf8')
describe('Sphex Social V1',()=>{
 it('registra todas as rotas e aliases sem links mortos',()=>{for(const route of ['social','social/explore','social/notifications','social/messages','social/saved','social/ranking','social/post/:id','social/:username','social/tag/:tag'])expect(app).toContain(`path="${route}"`);expect(app).toContain('/dashboard/social/*');expect(layout).toContain("['Social','/app/social'")})
 it('é carregado sob demanda',()=>expect(app).toContain("lazy(()=>import('./features/social/SocialPage'))"))
 it('trata texto como React text e links externos com proteção',()=>{expect(page).not.toContain('dangerouslySetInnerHTML');expect(page).toContain('rel="noopener noreferrer"');expect(page).toContain("/^https?:\\/\\//i")})
 it('envia mídia somente pela função server-side e usa caminhos definidos pelo usuário autenticado',()=>{expect(service).toContain("['image/jpeg','image/png','image/webp']");expect(service).toContain('file.size>10*1024*1024');expect(service).toContain("functions.invoke('social-media-upload'");expect(sql).toContain("split_part(name,'/',1)=auth.uid()::text")})
 it('possui constraints de unicidade e auto-follow',()=>{expect(sql).toContain('primary key(user_id,post_id)');expect(sql).toContain('primary key(follower_id,following_id)');expect(sql).toContain('check(follower_id<>following_id)')})
 it('protege ownership, bookmarks, notifications e mensagens via RLS',()=>{expect(sql).toContain('author_id=auth.uid()');expect(sql).toContain('social_bookmarks_owner');expect(sql).toContain('recipient_id=auth.uid()');expect(sql).toContain('social_is_member(conversation_id,auth.uid())')})
 it('limita posts e mensagens no servidor',()=>{expect(sql).toContain("created_at>now()-interval '1 minute')>=10");expect(sql).toContain("created_at>now()-interval '1 minute')<30")})
 it('limita likes e follows e evita flood de notificações',()=>{expect(sql).toContain("social_recent_actions(auth.uid(),'like'");expect(sql).toContain("social_recent_actions(auth.uid(),'follow'");expect(sql).toContain('social_notifications_dedupe_idx')})
 it('aplica mute no feed e calcula ranking apenas com métricas sociais',()=>{expect(service).toContain("from('social_mutes')");expect(service).toContain("rpc('social_ranking'");expect(sql).toContain('pc.posts*2+ec.engagement+fc.followers');expect(sql).not.toMatch(/revenue|faturamento|balance/)})
 it('restringe website e desabilita vídeo ainda não suportado',()=>{expect(sql).toContain("website ~ '^https://");expect(sql).toContain("media_type = 'image'");expect(page).not.toContain('accept="video')})
 it('ativa realtime apenas para notificações e mensagens',()=>{expect(sql).toContain('add table public.social_notifications');expect(sql).toContain('add table public.social_messages');expect(sql).not.toContain('add table public.social_posts')})
 it('pesquisa posts no PostgreSQL com configuração portuguesa e sob RLS',()=>{expect(service).toContain("rpc('social_search_posts'");expect(sql).toContain("to_tsvector('portuguese',p.body)");expect(sql).toContain('security invoker')})
 it('não retorna Promises como cleanup dos effects assíncronos',()=>{expect(page).toContain("useEffect(()=>{void socialService.getProfile");expect(page).toContain("useEffect(()=>{void socialService.ranking")})
})
