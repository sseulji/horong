# 호롱 HORONG — MVP

> 같은 문장에 멈춘 사람을 비추는 불

같은 책의 같은 장면에 남겨진 다른 독자의 감정과 질문을 발견하고, 원하면 대화하면서 자기 속도로 읽는 소셜 리딩 웹앱 (PRD v2.0).
디자인 기준(IA · 토큰 · 컴포넌트 · 플로우 · 화면 13종)은 Design 캔버스 **HORONG 호롱 — UX/UI**에 있습니다.

## 실행

### Windows 빠른 세팅
압축을 푼 `horong` 폴더에서 **`setup.bat` 더블클릭** → Node.js/Git/GitHub CLI 확인·설치 → `npm install` → GitHub 로그인 → **비공개 저장소 `horong` 생성 후 push** → VS Code 열기 → `npm run dev`.
(`.env.local`은 `.gitignore`로 제외되어 GitHub에 올라가지 않아요.)

### 직접 실행

```bash
npm install
cp .env.example .env.local      # Supabase URL / anon key 입력
npm run dev                     # http://localhost:3000
```

**연결된 Supabase 프로젝트:** `horong` (서울, ref `gtuzwhxikshhsdcmgmmu`) — 0001~0003 마이그레이션 적용 완료, `.env.local` 포함.

새 프로젝트에 다시 만들 때
1. 새 프로젝트 생성 → SQL Editor에서 `supabase/migrations/0001_schema.sql`, `0002_seed.sql`, `0003_harden.sql` 순서대로 실행
2. Authentication → Providers → Email 활성화 (개발 중엔 "Confirm email"을 꺼두면 바로 로그인)
3. Authentication → URL Configuration의 Redirect URL에 `http://localhost:3000/auth/callback` 추가
4. Database → Replication에서 `chat_messages`, `notifications`가 `supabase_realtime`에 포함됐는지 확인 (마이그레이션이 추가함)

env가 없으면 앱은 `/setup` 안내 화면을 보여줍니다. `ANTHROPIC_API_KEY`가 없으면 AI 발제문은 샘플 질문 템플릿으로 동작합니다.

## 스택
Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind CSS v4 (`@theme` 토큰) · Supabase Auth · PostgreSQL + RLS · Supabase Realtime

## 구조

```
app/
  page.tsx                       Splash · Onboarding
  login/ auth/callback/ setup/   인증
  (app)/                         로그인 필요 영역 (AppShell: 탭/레일 · 알림 · 독서등 컨텍스트)
    home/                        Home (재개 카드 · 새 질문 · 친구)
    library/                     My Library (상태 변경 · 검색 · 중복 방지)
    discover/                    도서 검색 (DB + Open Library) · 서재 담기
    read/[bookId]/               Reading Mode (장면 진도 · 집중 모드 · 독서 마무리)
    read/[bookId]/record/        Passage Highlight(손 하이라이트 시뮬레이션) + Emotion Record
    books/[bookId]/scenes/[idx]/ Reader Discovery (공감 · 답글 · 신고 · 차단 · 대화 요청 · 스포일러)
      questions/                 AI Discussion Questions
    chat/[roomId]/               30-minute Chat (Realtime · 타이머 · 저장 선택)
    connect/                     Friend Reading · 친구/대화 요청
    resume/[bookId]/             Reading Resume (체크인 → NSM)
    device/                      HORONG Device Control (Simulator)
    settings/                    Profile & Settings (공개 범위 · 모션 · 차단 · 삭제)
  api/questions/                 AI 발제문 API → lib/ai/questions.ts
lib/
  actions.ts                     모든 Server Actions (zod 검증)
  ai/questions.ts                AI 서비스 계층: Provider 인터페이스, Anthropic / Sample, 스포일러 가드
  device/provider.ts             DeviceProvider 인터페이스 + MockDeviceProvider
  books.ts                       Open Library 검색
  sim-pages.ts                   손 하이라이트 시뮬레이션용 퍼블릭 도메인 대목
components/                      Horong(SVG 캐릭터 6상태), AppShell, NoteCard, ChatRoom …
supabase/migrations/             스키마 · RLS · RPC · 트리거 · 시드
supabase/tests/                  로컬 Postgres용 RLS 스모크 테스트
```

## PRD 대응

| PRD | 구현 |
|---|---|
| F01 서재 | `user_books` PK로 중복 방지, 상태 순환 변경, 진도는 선택 입력 |
| F02 독서 모드 | 세션 기록(`reading_sessions`), 집중 모드 ↔ 독서등 동기화 |
| F03 구절·감정 | 구절 입력 / 장면 설명 / 손 하이라이트(시뮬레이션), 감정 최대 3, 공개 범위 |
| F04 AI 발제문 | 별도 API·서비스 계층, 최대 3개, 수정·삭제·직접 작성, AI 라벨, 읽은 장면까지만, 실패 시 템플릿 |
| F05 감상 발견 | `discover_notes()` — 책 → 장면 → 공개 범위·차단(RLS) → 진도 기반 스포일러 가림, 빈 상태 문구 |
| F06 30분 채팅 | 요청→수락 시 30분, 만료 후 insert를 RLS가 거부, 저장은 본인 선택(나만 보기) |
| F07 친구 | 요청·수락, 진도는 동의 시에만(`friend_progress()`), 순위 없음 |
| F08 재개 | 도착 알림 기반 재개 카드, 체크인 → `reading_sessions.resumed` |
| 8.5 독서등 | `MockDeviceProvider`로 연결/해제·밝기·Focus·Question/Opinion/Connected Reader·Light State, 상태 DB 저장 |
| 16 안전 | 신고(3건 이상 자동 숨김)·양방향 차단·내 콘텐츠 전체 삭제·위치/연락처 미수집 |

## 시뮬레이션 · 제약
- **독서등**: 실물 연결 없음. `DeviceProvider`를 BLE 구현으로 교체하면 됩니다.
- **손 하이라이트**: 기술 검증 전. 퍼블릭 도메인 원작 「운수 좋은 날」 첫 대목에서만 줄 단위 탭으로 시뮬레이션합니다.
- **도서 데이터**: 시드 4권은 저작권 보호기간이 끝난 근대 소설(판본별 ISBN은 비움). 그 밖의 책은 Open Library 검색으로 추가하며, 기본 10개 장면 번호가 생깁니다.
- **스포일러 보호**는 UX 보호 장치(RPC)이고, 개인정보·권한은 RLS가 서버에서 보장합니다.

## 검증
- `npm run build` 통과 (타입 체크 포함)
- 로컬 PostgreSQL 16에서 마이그레이션 실행 + `supabase/tests/rls_smoke.sql`로 진도 비공개, 친구 전용, 차단, 스포일러, 채팅 수락 전/만료 후 입력 거부, 알림 트리거 확인
- 실제 Supabase 프로젝트와 브라우저에서의 E2E 테스트는 아직 하지 않았습니다.
