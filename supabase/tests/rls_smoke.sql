-- RLS 스모크 테스트 (로컬 Postgres + supabase/tests/stub.sql 위에서 실행)
\set ON_ERROR_STOP 1
insert into auth.users(id, raw_user_meta_data) values
 ('aaaaaaaa-0000-4000-8000-000000000001','{"nickname":"밤산책"}'),
 ('bbbbbbbb-0000-4000-8000-000000000002','{"nickname":"창가의섬"}'),
 ('cccccccc-0000-4000-8000-000000000003','{"nickname":"느린고양이"}');
set role authenticated;
-- A writes notes
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
insert into user_books(user_id,book_id,current_scene) values (auth.uid(),'00000000-0000-4000-8000-000000000001',7);
insert into notes(user_id,book_id,scene_idx,emotions,body,visibility) values
 (auth.uid(),'00000000-0000-4000-8000-000000000001',1,'{sad}','첫 문장부터 불안','public'),
 (auth.uid(),'00000000-0000-4000-8000-000000000001',7,'{surprise}','결말 감상','public'),
 (auth.uid(),'00000000-0000-4000-8000-000000000001',1,'{comfort}','친구 전용','friends'),
 (auth.uid(),'00000000-0000-4000-8000-000000000001',1,'{}','비공개','private');
-- B progress scene 2
set request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';
insert into user_books(user_id,book_id,current_scene) values (auth.uid(),'00000000-0000-4000-8000-000000000001',2);
select 'B scene1 visible', count(*) from discover_notes('00000000-0000-4000-8000-000000000001',1);
select 'B scene7 spoiler', is_spoiler, body is null as body_hidden from discover_notes('00000000-0000-4000-8000-000000000001',7);
select 'B scene7 reveal', body from discover_notes('00000000-0000-4000-8000-000000000001',7,true);
select 'B sees A user_books (expect 0)', count(*) from user_books where user_id='aaaaaaaa-0000-4000-8000-000000000001';
insert into friendships(requester,addressee) values (auth.uid(),'aaaaaaaa-0000-4000-8000-000000000001');
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
update friendships set status='accepted' where addressee=auth.uid();
set request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';
select 'B after friend', count(*) from discover_notes('00000000-0000-4000-8000-000000000001',1);
select 'friend progress hidden (null)', current_scene from friend_progress();
-- C blocked by A
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
insert into blocks values (auth.uid(),'cccccccc-0000-4000-8000-000000000003');
set request.jwt.claim.sub = 'cccccccc-0000-4000-8000-000000000003';
select 'C blocked sees', count(*) from notes;
-- chat
set request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';
insert into chat_rooms(id,book_id,scene_idx,requester,addressee) values ('dddddddd-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001',1,auth.uid(),'aaaaaaaa-0000-4000-8000-000000000001');
do $$ begin insert into chat_messages(room_id,user_id,body) values ('dddddddd-0000-4000-8000-000000000004',auth.uid(),'hi'); raise notice 'FAIL: msg before open'; exception when others then raise notice 'ok: blocked before open'; end $$;
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
select respond_chat('dddddddd-0000-4000-8000-000000000004', true);
insert into chat_messages(room_id,user_id,body) values ('dddddddd-0000-4000-8000-000000000004',auth.uid(),'안녕하세요');
select 'A notifications', kind from notifications;
set request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';
insert into comments(note_id,user_id,body) select id, auth.uid(), '저도요' from notes where body='첫 문장부터 불안';
select 'B notifs', kind from notifications;
reset role;
update chat_rooms set expires_at = now() - interval '1 minute';
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
select 'A notifs', kind from notifications order by created_at;
do $$ begin insert into chat_messages(room_id,user_id,body) values ('dddddddd-0000-4000-8000-000000000004',auth.uid(),'late'); raise notice 'FAIL: late msg'; exception when others then raise notice 'ok: expired room blocks input'; end $$;
