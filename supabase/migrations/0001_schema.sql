-- =====================================================================
-- HORONG 호롱 — MVP schema (PRD v2.0 §12)
-- Supabase / PostgreSQL. Run in order: 0001_schema.sql → 0002_seed.sql
-- 원칙
--   * 모든 사용자 데이터는 RLS로 서버 수준에서 보호한다.
--   * 공개(public) / 친구(friends) / 나만(private) 범위를 정책으로 구분한다.
--   * 차단 관계에 있는 사용자의 콘텐츠는 서로 보이지 않는다.
--   * 독서 진도는 기본 비공개이며, 친구에게도 동의한 경우에만 노출한다.
--   * 스포일러 보호는 discover_notes() RPC가 내 진도 기준으로 본문을 가린다.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Enums ----------------------------------------------------
create type reading_status   as enum ('reading', 'paused', 'done');
create type visibility        as enum ('private', 'friends', 'public');
create type emotion_tag       as enum ('overwhelmed','empathy','sad','flutter','comfort','surprise','anger','curious');
create type question_source   as enum ('user', 'ai');
create type question_type     as enum ('emotion', 'interpretation', 'perspective', 'other');
create type friendship_status as enum ('pending', 'accepted');
create type chat_status       as enum ('requested', 'open', 'closed', 'declined');
create type report_target     as enum ('note', 'comment', 'question', 'chat_message', 'user');
create type horong_state      as enum ('idle', 'remember', 'connect', 'receive', 'focus', 'sleep');

-- ---------- users (profiles) -----------------------------------------
create table public.profiles (
  id                           uuid primary key references auth.users(id) on delete cascade,
  nickname                     text not null check (char_length(nickname) between 1 and 24),
  default_visibility           visibility not null default 'public',
  share_progress_with_friends  boolean not null default false,  -- 진도 기본 비공개
  allow_chat_requests          boolean not null default true,
  light_notifications          boolean not null default true,
  reduce_motion                boolean not null default false,
  onboarded_at                 timestamptz,
  created_at                   timestamptz not null default now()
);

-- ---------- books & scenes -------------------------------------------
create table public.books (
  id             uuid primary key default gen_random_uuid(),
  isbn13         text unique check (isbn13 ~ '^[0-9]{13}$'),
  title          text not null,
  author         text not null,
  publisher      text,
  published_year int,
  cover_url      text,
  source         text not null default 'seed' check (source in ('seed', 'openlibrary', 'manual')),
  external_id    text,
  scene_count    int not null default 10 check (scene_count between 1 and 200),
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (source, external_id)
);

-- 장면 그룹: 구절/감상 매칭의 기본 단위 (PRD F05 Matching Rule 2)
create table public.scenes (
  book_id  uuid not null references public.books(id) on delete cascade,
  idx      int  not null check (idx >= 1),
  title    text not null,              -- 스포일러 없는 짧은 라벨
  primary key (book_id, idx)
);

-- ---------- user_books (서재 · 독서 상태) -----------------------------
create table public.user_books (
  user_id        uuid not null references auth.users(id) on delete cascade,
  book_id        uuid not null references public.books(id) on delete cascade,
  status         reading_status not null default 'reading',
  current_scene  int check (current_scene >= 1),   -- 진도 입력은 선택
  last_read_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (user_id, book_id)                    -- 중복 등록 방지
);

-- ---------- passages ---------------------------------------------------
create table public.passages (
  id           uuid primary key default gen_random_uuid(),
  book_id      uuid not null references public.books(id) on delete cascade,
  scene_idx    int  not null check (scene_idx >= 1),
  kind         text not null check (kind in ('quote', 'scene', 'hand_sim')),
  quote        text check (char_length(quote) <= 300),        -- 짧은 인용만
  description  text check (char_length(description) <= 300),
  page_hint    text check (char_length(page_hint) <= 40),
  quote_norm   text generated always as (regexp_replace(lower(coalesce(quote, '')), '[[:space:][:punct:]]', '', 'g')) stored,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  check (quote is not null or description is not null)
);
create index passages_match_idx on public.passages (book_id, scene_idx);
create index passages_quote_idx on public.passages (book_id, quote_norm) where quote is not null;

-- ---------- notes (감상) ----------------------------------------------
create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  book_id     uuid not null references public.books(id) on delete cascade,
  scene_idx   int  not null check (scene_idx >= 1),
  passage_id  uuid references public.passages(id) on delete set null,
  emotions    emotion_tag[] not null default '{}' check (cardinality(emotions) <= 3),
  body        text check (char_length(body) <= 500),
  visibility  visibility not null default 'public',
  hidden      boolean not null default false,       -- 신고 누적 시 운영 숨김
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index notes_scene_idx on public.notes (book_id, scene_idx, created_at desc);

create table public.reactions (
  note_id    uuid not null references public.notes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, user_id)                   -- 공감은 1인 1회
);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  note_id    uuid not null references public.notes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index comments_note_idx on public.comments (note_id, created_at);

-- ---------- questions (사용자/AI 발제문) -----------------------------
create table public.questions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  book_id     uuid not null references public.books(id) on delete cascade,
  scene_idx   int  not null check (scene_idx >= 1),
  body        text not null check (char_length(body) between 1 and 300),
  source      question_source not null default 'user',
  qtype       question_type not null default 'other',
  visibility  visibility not null default 'public',
  created_at  timestamptz not null default now()
);
create index questions_scene_idx on public.questions (book_id, scene_idx, created_at desc);

-- ---------- social ----------------------------------------------------
create table public.friendships (
  id          uuid primary key default gen_random_uuid(),
  requester   uuid not null references auth.users(id) on delete cascade,
  addressee   uuid not null references auth.users(id) on delete cascade,
  status      friendship_status not null default 'pending',
  created_at  timestamptz not null default now(),
  check (requester <> addressee)
);
create unique index friendships_pair_uq on public.friendships (least(requester, addressee), greatest(requester, addressee));

create table public.blocks (
  blocker    uuid not null references auth.users(id) on delete cascade,
  blocked    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter    uuid not null references auth.users(id) on delete cascade,
  target_type report_target not null,
  target_id   uuid not null,
  reason      text not null check (char_length(reason) between 1 and 300),
  status      text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at  timestamptz not null default now(),
  unique (reporter, target_type, target_id)
);

-- ---------- reading sessions -----------------------------------------
create table public.reading_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  book_id     uuid not null references public.books(id) on delete cascade,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  scene_from  int,
  scene_to    int,
  resumed     boolean not null default false,   -- 재개 체크인 (NSM 집계)
  trigger     text check (trigger in ('home', 'resume_card', 'notification', 'library'))
);
create index reading_sessions_user_idx on public.reading_sessions (user_id, started_at desc);

-- ---------- 30분 채팅 -------------------------------------------------
create table public.chat_rooms (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references public.books(id) on delete cascade,
  scene_idx   int  not null,
  requester   uuid not null references auth.users(id) on delete cascade,
  addressee   uuid not null references auth.users(id) on delete cascade,
  status      chat_status not null default 'requested',
  opened_at   timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  check (requester <> addressee)
);

create table public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.chat_rooms(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index chat_messages_room_idx on public.chat_messages (room_id, created_at);

-- ---------- devices ---------------------------------------------------
create table public.devices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null default '호롱 독서등',
  kind         text not null default 'virtual' check (kind in ('virtual', 'ble')),
  connected    boolean not null default false,
  brightness   int not null default 60 check (brightness between 0 and 100),
  focus_mode   boolean not null default false,
  light_state  horong_state not null default 'idle',
  battery      int check (battery between 0 and 100),
  firmware     text,
  updated_at   timestamptz not null default now()
);

create table public.device_events (
  id          bigserial primary key,
  device_id   uuid not null references public.devices(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  event_type  text not null check (event_type in ('connect','disconnect','brightness','focus','light_state','question_arrived','opinion_arrived','connected_reader')),
  payload     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- ---------- notifications --------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('comment', 'question', 'reaction', 'chat_request', 'chat_open', 'friend_request')),
  actor_id    uuid references auth.users(id) on delete set null,
  book_id     uuid references public.books(id) on delete cascade,
  scene_idx   int,
  ref_id      uuid,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- =====================================================================
-- Helper functions (security definer: 정책 안에서 다른 테이블을 안전하게 조회)
-- =====================================================================
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

create or replace function public.is_friend(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester = a and addressee = b) or (requester = b and addressee = a))
  );
$$;

-- 콘텐츠 열람 가능 여부 (공개 범위 + 차단)
create or replace function public.can_view(owner uuid, vis visibility)
returns boolean language sql stable security definer set search_path = public as $$
  select owner = auth.uid()
      or (not is_blocked_between(owner, auth.uid())
          and (vis = 'public' or (vis = 'friends' and is_friend(owner, auth.uid()))));
$$;

-- 내 진도 (스포일러 기준). 완독이면 전체 허용, 진도 미입력이면 1장면만.
create or replace function public.my_scene(p_book uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case when status = 'done' then 100000 else current_scene end
       from user_books where user_id = auth.uid() and book_id = p_book),
    1);
$$;

create or replace function public.accepts_chat(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select allow_chat_requests from profiles where id = p_user), false);
$$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.profiles          enable row level security;
alter table public.books             enable row level security;
alter table public.scenes            enable row level security;
alter table public.user_books        enable row level security;
alter table public.passages          enable row level security;
alter table public.notes             enable row level security;
alter table public.reactions         enable row level security;
alter table public.comments          enable row level security;
alter table public.questions         enable row level security;
alter table public.friendships       enable row level security;
alter table public.blocks            enable row level security;
alter table public.reports           enable row level security;
alter table public.reading_sessions  enable row level security;
alter table public.chat_rooms        enable row level security;
alter table public.chat_messages     enable row level security;
alter table public.devices           enable row level security;
alter table public.device_events     enable row level security;
alter table public.notifications     enable row level security;

-- profiles: 닉네임은 로그인 사용자에게 보이지만 설정 컬럼은 public_profiles 뷰로만 노출
create policy profiles_self_all on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create or replace view public.public_profiles with (security_invoker = false) as
  select id, nickname from public.profiles;
grant select on public.public_profiles to authenticated;

-- books / scenes: 누구나 읽기, 로그인 사용자는 검색 결과를 추가 가능
create policy books_read   on public.books  for select using (true);
create policy books_insert on public.books  for insert to authenticated with check (created_by = auth.uid() and source <> 'seed');
create policy scenes_read  on public.scenes for select using (true);
create policy scenes_insert on public.scenes for insert to authenticated
  with check (exists (select 1 from books b where b.id = book_id and b.created_by = auth.uid()));

-- user_books: 본인만. 친구 진도는 friend_progress() 로만 (동의 시)
create policy user_books_self on public.user_books for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- passages: 작성자 + 해당 구절을 참조하는 공개 감상이 있으면 열람
create policy passages_insert on public.passages for insert to authenticated with check (created_by = auth.uid());
create policy passages_read on public.passages for select using (
  created_by = auth.uid()
  or exists (select 1 from notes n where n.passage_id = passages.id and not n.hidden and can_view(n.user_id, n.visibility))
);
create policy passages_delete on public.passages for delete using (created_by = auth.uid());

-- notes
create policy notes_read   on public.notes for select using (not hidden and can_view(user_id, visibility) or user_id = auth.uid());
create policy notes_insert on public.notes for insert to authenticated with check (user_id = auth.uid());
create policy notes_update on public.notes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notes_delete on public.notes for delete using (user_id = auth.uid());

-- reactions / comments: 볼 수 있는 감상에만
create policy reactions_read on public.reactions for select using (exists (select 1 from notes n where n.id = note_id));
create policy reactions_ins  on public.reactions for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from notes n where n.id = note_id));
create policy reactions_del  on public.reactions for delete using (user_id = auth.uid());

create policy comments_read on public.comments for select using (
  exists (select 1 from notes n where n.id = note_id) and not is_blocked_between(user_id, auth.uid())
);
create policy comments_ins on public.comments for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from notes n where n.id = note_id and not is_blocked_between(n.user_id, auth.uid()))
);
create policy comments_del on public.comments for delete using (user_id = auth.uid());

-- questions
create policy questions_read on public.questions for select using (can_view(user_id, visibility));
create policy questions_ins  on public.questions for insert to authenticated with check (user_id = auth.uid());
create policy questions_upd  on public.questions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy questions_del  on public.questions for delete using (user_id = auth.uid());

-- friendships: 당사자만. 수락은 addressee만.
create policy friendships_read on public.friendships for select using (auth.uid() in (requester, addressee));
create policy friendships_ins  on public.friendships for insert to authenticated with check (
  requester = auth.uid() and status = 'pending' and not is_blocked_between(requester, addressee)
);
create policy friendships_accept on public.friendships for update using (addressee = auth.uid()) with check (addressee = auth.uid());
create policy friendships_del on public.friendships for delete using (auth.uid() in (requester, addressee));

-- blocks / reports: 본인 것만
create policy blocks_self  on public.blocks  for all using (blocker = auth.uid()) with check (blocker = auth.uid());
create policy reports_ins  on public.reports for insert to authenticated with check (reporter = auth.uid());
create policy reports_read on public.reports for select using (reporter = auth.uid());

-- sessions / devices / events / notifications: 본인만
create policy sessions_self      on public.reading_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy devices_self       on public.devices          for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy device_events_self on public.device_events    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_self_read on public.notifications for select using (user_id = auth.uid());
create policy notifications_self_upd  on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_self_del  on public.notifications for delete using (user_id = auth.uid());

-- chat: 당사자만. 요청은 상대가 허용·차단 안 함일 때만. 상태 변경은 RPC로.
create policy chat_rooms_read on public.chat_rooms for select using (auth.uid() in (requester, addressee));
create policy chat_rooms_ins on public.chat_rooms for insert to authenticated with check (
  requester = auth.uid() and status = 'requested'
  and not is_blocked_between(requester, addressee)
  and accepts_chat(addressee)
);
create policy chat_messages_read on public.chat_messages for select using (
  exists (select 1 from chat_rooms r where r.id = room_id and auth.uid() in (r.requester, r.addressee))
);
-- 30분이 지나면 새 메시지 입력 종료 (PRD F06)
create policy chat_messages_ins on public.chat_messages for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from chat_rooms r where r.id = room_id and auth.uid() in (r.requester, r.addressee)
              and r.status = 'open' and now() < r.expires_at)
);

-- =====================================================================
-- RPCs
-- =====================================================================

-- 같은 장면 감상 발견 + 스포일러 보호 (PRD F05 Matching Rules 1–5)
create or replace function public.discover_notes(p_book uuid, p_scene int, p_reveal boolean default false)
returns table (
  id uuid, user_id uuid, nickname text, scene_idx int, emotions emotion_tag[], body text,
  quote text, description text, visibility visibility, created_at timestamptz,
  empathy_count bigint, comment_count bigint, i_empathized boolean, is_spoiler boolean, is_mine boolean
) language sql stable security invoker set search_path = public as $$
  select n.id, n.user_id, p.nickname, n.scene_idx, n.emotions,
         case when n.scene_idx > my_scene(p_book) and not p_reveal and n.user_id <> auth.uid() then null else n.body end,
         case when n.scene_idx > my_scene(p_book) and not p_reveal and n.user_id <> auth.uid() then null else ps.quote end,
         case when n.scene_idx > my_scene(p_book) and not p_reveal and n.user_id <> auth.uid() then null else ps.description end,
         n.visibility, n.created_at,
         (select count(*) from reactions r where r.note_id = n.id),
         (select count(*) from comments c where c.note_id = n.id),
         exists (select 1 from reactions r where r.note_id = n.id and r.user_id = auth.uid()),
         n.scene_idx > my_scene(p_book) and n.user_id <> auth.uid(),
         n.user_id = auth.uid()
  from notes n                                  -- RLS: 공개 범위 + 차단 필터
  join public_profiles p on p.id = n.user_id
  left join passages ps on ps.id = n.passage_id
  where n.book_id = p_book and n.scene_idx = p_scene
  order by n.created_at desc
  limit 100;
$$;

-- 친구 진도 (동의한 친구만 정확한 장면, 나머지는 상태만)
create or replace function public.friend_progress()
returns table (friend_id uuid, nickname text, book_id uuid, title text, status reading_status, current_scene int, device_connected boolean)
language sql stable security definer set search_path = public as $$
  select f.fid, p.nickname, ub.book_id, b.title, ub.status,
         case when p.share_progress_with_friends then ub.current_scene else null end,
         exists (select 1 from devices d where d.user_id = f.fid and d.connected)
  from (select case when requester = auth.uid() then addressee else requester end as fid
          from friendships where status = 'accepted' and auth.uid() in (requester, addressee)) f
  join profiles p on p.id = f.fid
  left join user_books ub on ub.user_id = f.fid and ub.status <> 'done'
  left join books b on b.id = ub.book_id;
$$;

-- 채팅 수락/거절/종료
create or replace function public.respond_chat(p_room uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update chat_rooms
     set status = case when p_accept then 'open'::chat_status else 'declined'::chat_status end,
         opened_at = case when p_accept then now() end,
         expires_at = case when p_accept then now() + interval '30 minutes' end
   where id = p_room and addressee = auth.uid() and status = 'requested';
  if not found then raise exception 'not allowed'; end if;
  if p_accept then
    insert into notifications (user_id, kind, actor_id, ref_id)
    select requester, 'chat_open', auth.uid(), id from chat_rooms where id = p_room;
  end if;
end $$;

create or replace function public.close_chat(p_room uuid)
returns void language sql security definer set search_path = public as $$
  update chat_rooms set status = 'closed', expires_at = least(coalesce(expires_at, now()), now())
   where id = p_room and auth.uid() in (requester, addressee);
$$;

-- 내 데이터 삭제 (감상·대화·질문)
create or replace function public.delete_my_content()
returns void language sql security definer set search_path = public as $$
  delete from notes where user_id = auth.uid();
  delete from questions where user_id = auth.uid();
  delete from chat_messages where user_id = auth.uid();
  delete from comments where user_id = auth.uid();
$$;

-- =====================================================================
-- Triggers
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nickname)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'nickname', ''), '독자' || substr(new.id::text, 1, 4)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger user_books_touch before update on public.user_books for each row execute function public.touch_updated_at();
create trigger notes_touch      before update on public.notes      for each row execute function public.touch_updated_at();

-- 답글 → 감상 작성자에게 (호롱 Receive)
create or replace function public.notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, kind, actor_id, book_id, scene_idx, ref_id)
  select n.user_id, 'comment', new.user_id, n.book_id, n.scene_idx, n.id
    from notes n where n.id = new.note_id and n.user_id <> new.user_id;
  return new;
end $$;
create trigger comments_notify after insert on public.comments for each row execute function public.notify_comment();

-- 공개 질문 → 같은 장면에 감상을 남긴 독자에게 (차단 제외)
create or replace function public.notify_question()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.visibility = 'public' then
    insert into notifications (user_id, kind, actor_id, book_id, scene_idx, ref_id)
    select distinct n.user_id, 'question', new.user_id, new.book_id, new.scene_idx, new.id
      from notes n
     where n.book_id = new.book_id and n.scene_idx = new.scene_idx
       and n.user_id <> new.user_id and not is_blocked_between(n.user_id, new.user_id);
  end if;
  return new;
end $$;
create trigger questions_notify after insert on public.questions for each row execute function public.notify_question();

create or replace function public.notify_chat_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, kind, actor_id, book_id, scene_idx, ref_id)
  values (new.addressee, 'chat_request', new.requester, new.book_id, new.scene_idx, new.id);
  return new;
end $$;
create trigger chat_request_notify after insert on public.chat_rooms for each row execute function public.notify_chat_request();

create or replace function public.notify_friend_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, kind, actor_id, ref_id) values (new.addressee, 'friend_request', new.requester, new.id);
  return new;
end $$;
create trigger friend_request_notify after insert on public.friendships for each row execute function public.notify_friend_request();

-- 신고 3건 이상이면 감상 자동 숨김
create or replace function public.auto_hide_reported()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.target_type = 'note' and (select count(*) from reports where target_type = 'note' and target_id = new.target_id) >= 3 then
    update notes set hidden = true where id = new.target_id;
  end if;
  return new;
end $$;
create trigger reports_autohide after insert on public.reports for each row execute function public.auto_hide_reported();

-- Realtime: 채팅·알림 구독
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.notifications;
