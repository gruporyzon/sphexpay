\set ON_ERROR_STOP on
begin;
insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','social-a@example.invalid','',now(),now()),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','authenticated','authenticated','social-b@example.invalid','',now(),now()),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','authenticated','authenticated','social-c@example.invalid','',now(),now()) on conflict(id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
insert into public.social_profiles(user_id,username,display_name) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','creator_a','Creator A');
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
insert into public.social_profiles(user_id,username,display_name) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','creator_b','Creator B');
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
insert into public.social_profiles(user_id,username,display_name) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','creator_c','Creator C');

select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select public.social_create_post('Post público seguro #sphex',null,null) as post_a \gset
select set_config('test.post_a',:'post_a',true);
insert into public.social_posts(author_id,body,visibility) values(auth.uid(),'Somente seguidores','followers') returning id as followers_post \gset
select set_config('test.followers_post',:'followers_post',true);
select public.social_create_post('Post para soft delete',null,null) as deleted_post \gset
select set_config('test.deleted_post',:'deleted_post',true);
update public.social_posts set body='Post editado pelo owner',updated_at=now() where id=current_setting('test.post_a')::uuid;
update public.social_posts set status='deleted',deleted_at=now(),body='' where id=current_setting('test.deleted_post')::uuid;
do $$begin
 if not exists(select 1 from public.social_posts where id=current_setting('test.post_a')::uuid and body='Post editado pelo owner') then raise exception 'owner cannot update post';end if;
 if not exists(select 1 from public.social_posts where id=current_setting('test.deleted_post')::uuid and status='deleted') then raise exception 'soft delete did not persist';end if;
end$$;

select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $$declare n int;begin
 if not exists(select 1 from public.social_posts where id=current_setting('test.post_a')::uuid) then raise exception 'public post unreadable';end if;
 if exists(select 1 from public.social_posts where id=current_setting('test.deleted_post')::uuid) then raise exception 'deleted post leaked';end if;
 if exists(select 1 from public.social_posts where id=current_setting('test.followers_post')::uuid) then raise exception 'followers post leaked before follow';end if;
 update public.social_posts set body='IDOR' where id=current_setting('test.post_a')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'cross-user update allowed';end if;
 delete from public.social_posts where id=current_setting('test.post_a')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'cross-user delete allowed';end if;
end$$;
insert into public.social_likes(user_id,post_id) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',current_setting('test.post_a')::uuid);
do $$begin begin insert into public.social_likes(user_id,post_id) values(auth.uid(),current_setting('test.post_a')::uuid);raise exception 'duplicate like allowed';exception when unique_violation then null;end;end$$;
insert into public.social_bookmarks(user_id,post_id) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',current_setting('test.post_a')::uuid);
insert into public.social_follows(follower_id,following_id) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
do $$begin
 if not exists(select 1 from public.social_posts where id=current_setting('test.followers_post')::uuid) then raise exception 'followers post unavailable to follower';end if;
 begin insert into public.social_follows(follower_id,following_id) values(auth.uid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');raise exception 'duplicate follow allowed';exception when unique_violation then null;end;
 begin insert into public.social_follows(follower_id,following_id) values(auth.uid(),auth.uid());raise exception 'self follow allowed';exception when check_violation then null;end;
end$$;
select public.social_create_post('Comentário B',current_setting('test.post_a')::uuid,null) as comment_b \gset
select set_config('test.comment_b',:'comment_b',true);
select public.social_create_post('',null,current_setting('test.post_a')::uuid) as repost_b \gset
select set_config('test.repost_b',:'repost_b',true);
select public.social_create_post('Olá @creator_a',null,null) as mention_b \gset
select public.social_open_conversation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') as conversation_ab \gset
select set_config('test.conversation_ab',:'conversation_ab',true);
insert into public.social_messages(conversation_id,sender_id,body) values(:'conversation_ab','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Mensagem privada B para A');

select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $$begin
 if (select count(*) from public.social_notifications where recipient_id=auth.uid())<4 then raise exception 'notifications missing';end if;
 if not exists(select 1 from public.social_notifications where recipient_id=auth.uid() and actor_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and type='mention') then raise exception 'mention notification missing';end if;
 if not exists(select 1 from public.social_messages where conversation_id=current_setting('test.conversation_ab')::uuid) then raise exception 'participant cannot read messages';end if;
end$$;
do $$declare n int;begin
 update public.social_posts set body='owner tried editing comment' where id=current_setting('test.comment_b')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'post owner edited foreign comment';end if;
 if not exists(select 1 from public.social_posts where id=current_setting('test.repost_b')::uuid and repost_of_id=current_setting('test.post_a')::uuid) then raise exception 'repost reference missing';end if;
end$$;
insert into public.social_mutes(user_id,muted_user_id) values(auth.uid(),'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
do $$declare n int;begin
 if exists(select 1 from public.social_bookmarks where user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then raise exception 'bookmark leak';end if;
 if exists(select 1 from public.social_notifications where recipient_id in('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')) then raise exception 'notification leak';end if;
 if exists(select 1 from public.social_conversations where id=current_setting('test.conversation_ab')::uuid) then raise exception 'conversation leak';end if;
 if exists(select 1 from public.social_messages where conversation_id=current_setting('test.conversation_ab')::uuid) then raise exception 'message leak';end if;
 if exists(select 1 from public.social_mutes where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then raise exception 'mute leak';end if;
 update public.social_posts set body='C edits B comment' where id=current_setting('test.comment_b')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'comment IDOR allowed';end if;
 begin insert into public.social_messages(conversation_id,sender_id,body) values(current_setting('test.conversation_ab')::uuid,auth.uid(),'IDOR');raise exception 'message IDOR allowed';exception when insufficient_privilege then null;end;
end$$;

select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $$declare same_conversation uuid;begin
 same_conversation:=public.social_open_conversation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 if same_conversation<>current_setting('test.conversation_ab')::uuid then raise exception 'duplicate DM thread';end if;
 begin insert into public.social_messages(conversation_id,sender_id,body) values(current_setting('test.conversation_ab')::uuid,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','spoof');raise exception 'sender spoof allowed';exception when insufficient_privilege then null;end;
end$$;
insert into public.social_reports(reporter_id,target_type,target_id,reason) values(auth.uid(),'post',current_setting('test.post_a')::uuid,'spam');

select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $$begin if exists(select 1 from public.social_reports where reporter_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then raise exception 'report leak';end if;end$$;

select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
insert into public.social_blocks(blocker_id,blocked_id) values(auth.uid(),'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
do $$begin if exists(select 1 from public.social_follows where follower_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and following_id=auth.uid()) then raise exception 'block did not remove follow';end if;end$$;
rollback;
