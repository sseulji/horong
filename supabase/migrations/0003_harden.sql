-- =====================================================================
-- 0003 · 보안 강화 (Supabase Security Advisor 대응)
--  * 정책/트리거 전용 헬퍼 함수를 API에 노출되지 않는 private 스키마로 이동
--  * public_profiles 뷰를 security invoker로 바꾸고 닉네임만 반환하는 함수로 대체
--  * 앱이 호출하는 RPC는 로그인 사용자(authenticated)만 실행 가능
-- =====================================================================
create schema if not exists private;
grant usage on schema private to authenticated, anon;

alter function public.is_blocked_between(uuid, uuid) set schema private;
alter function public.is_friend(uuid, uuid)          set schema private;
alter function public.can_view(uuid, visibility)     set schema private;
alter function public.my_scene(uuid)                 set schema private;
alter function public.accepts_chat(uuid)             set schema private;
alter function public.handle_new_user()              set schema private;
alter function public.notify_comment()               set schema private;
alter function public.notify_question()              set schema private;
alter function public.notify_chat_request()          set schema private;
alter function public.notify_friend_request()        set schema private;
alter function public.auto_hide_reported()           set schema private;

alter function private.can_view(uuid, visibility)   set search_path = public, private;
alter function private.notify_question()            set search_path = public, private;
alter function public.discover_notes(uuid, int, boolean) set search_path = public, private;

-- 닉네임 공개: 설정 컬럼은 노출하지 않음
drop view if exists public.public_profiles;
create or replace function private.profile_names()
returns table (id uuid, nickname text) language sql stable security definer set search_path = public as $$
  select id, nickname from profiles;
$$;
create view public.public_profiles with (security_invoker = true) as
  select id, nickname from private.profile_names();
revoke all on public.public_profiles from anon, public;
grant select on public.public_profiles to authenticated;

-- 앱 RPC: 로그인 사용자만
revoke execute on function public.discover_notes(uuid, int, boolean) from anon, public;
revoke execute on function public.friend_progress()                  from anon, public;
revoke execute on function public.respond_chat(uuid, boolean)        from anon, public;
revoke execute on function public.close_chat(uuid)                   from anon, public;
revoke execute on function public.delete_my_content()                from anon, public;
grant  execute on function public.discover_notes(uuid, int, boolean) to authenticated;
grant  execute on function public.friend_progress()                  to authenticated;
grant  execute on function public.respond_chat(uuid, boolean)        to authenticated;
grant  execute on function public.close_chat(uuid)                   to authenticated;
grant  execute on function public.delete_my_content()                to authenticated;
