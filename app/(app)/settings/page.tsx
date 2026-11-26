import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { deleteMyContent, signOut, unblockUser, updatePrefs } from "@/lib/actions";
import { Horong } from "@/components/Horong";
import { BackLink, SectionTitle, btnPrimary } from "@/components/ui";
import { VISIBILITY } from "@/lib/constants";

export const metadata = { title: "프로필 · 설정" };

const TOGGLES = [
  ["share_progress_with_friends", "친구에게 정확한 진도 공개", "끄면 “읽는 중”만 보여요 · 기본 꺼짐"],
  ["allow_chat_requests", "30분 대화 요청 받기", "요청은 언제든 거절할 수 있어요"],
  ["light_notifications", "빛으로 알림 받기", "끄면 앱 안에서만 조용히 쌓여요"],
  ["reduce_motion", "모션 줄이기", "호롱의 움직임을 멈추고 상태를 글로 보여줘요"],
] as const;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string; confirm?: string }> }) {
  const { saved, deleted, confirm } = await searchParams;
  const { supabase, user } = await requireUser();
  const [{ data: p }, { data: blocks }, { count: noteCount }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("blocks").select("blocked").eq("blocker", user.id),
    supabase.from("notes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  const ids = (blocks ?? []).map((b) => b.blocked);
  const { data: names } = ids.length ? await supabase.from("public_profiles").select("id, nickname").in("id", ids) : { data: [] };

  return (
    <main className="flex flex-col gap-5 px-5 pb-8 pt-3">
      <header className="flex items-center gap-2"><BackLink href="/library" label="내 서재로" /><h1 className="text-base font-medium">프로필 · 설정</h1></header>
      <div className="flex items-center gap-4 rounded-[22px] bg-[radial-gradient(120%_120%_at_0%_0%,rgba(104,100,199,0.3),rgba(29,26,54,0.9))] p-4">
        <Horong state={p?.reduce_motion ? "focus" : "idle"} size={64} />
        <div className="flex flex-col gap-1"><span className="font-serif text-xl">{p?.nickname}</span><span className="text-xs text-ink-2">남긴 감상 {noteCount ?? 0}</span></div>
      </div>
      {saved && <p role="status" className="text-sm text-pink">설정을 저장했어요.</p>}
      {deleted && <p role="status" className="text-sm text-danger">감상·질문·대화 기록을 삭제했어요.</p>}

      <form action={updatePrefs} className="flex flex-col gap-2">
        <SectionTitle>공개 범위 · 개인정보</SectionTitle>
        <label className="flex flex-col gap-1.5 text-sm">닉네임
          <input name="nickname" defaultValue={p?.nickname} maxLength={24} className="h-12 rounded-2xl border border-lavender/30 bg-white/5 px-4 outline-none" />
        </label>
        {TOGGLES.map(([k, label, help]) => (
          <label key={k} className="flex min-h-[60px] cursor-pointer items-center gap-3 rounded-2xl border line bg-white/[0.04] px-4 py-2.5">
            <span className="flex flex-1 flex-col gap-0.5 text-sm"><span>{label}</span><span className="text-xs text-ink-3">{help}</span></span>
            <input type="checkbox" role="switch" name={k} defaultChecked={Boolean(p?.[k])} className="size-6 accent-flame" />
          </label>
        ))}
        <fieldset className="flex flex-col gap-2 rounded-2xl border line px-4 py-3.5">
          <legend className="px-1 text-sm">감상 기본 공개 범위</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {VISIBILITY.map((v) => (
              <label key={v.id} className="flex h-10 cursor-pointer items-center justify-center rounded-xl border border-lavender/30 text-[13px] has-[:checked]:border-lavender has-[:checked]:bg-flame/35">
                <input type="radio" name="default_visibility" value={v.id} defaultChecked={p?.default_visibility === v.id} className="sr-only-input" />{v.label}
              </label>
            ))}
          </div>
        </fieldset>
        <button className={`${btnPrimary} mt-1`}>설정 저장</button>
      </form>

      <section className="flex flex-col gap-2">
        <SectionTitle>호롱 · 독서등</SectionTitle>
        <Link href="/device" className="flex min-h-14 items-center rounded-2xl border border-blue/35 px-4 text-sm"><span className="flex-1">스마트 독서등 연결 · 관리</span><span className="text-xs text-blue">시뮬레이터 ›</span></Link>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>차단한 독자</SectionTitle>
        {(names ?? []).map((n) => (
          <form key={n.id} action={unblockUser.bind(null, n.id)} className="flex min-h-[52px] items-center rounded-2xl border line px-4 text-sm">
            <span className="flex-1">{n.nickname}</span><button className="min-h-10 px-2 text-[13px] text-pink">차단 해제</button>
          </form>
        ))}
        {!ids.length && <p className="text-[13px] text-ink-3">차단한 독자가 없어요.</p>}
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>계정</SectionTitle>
        <form action={signOut}><button className="flex min-h-[52px] w-full items-center rounded-2xl border line px-4 text-left text-sm">로그아웃</button></form>
        {confirm ? (
          <div role="alertdialog" aria-label="삭제 확인" className="flex flex-col gap-2.5 rounded-2xl border border-danger p-4">
            <p className="text-sm leading-relaxed">감상 {noteCount ?? 0}개와 질문·답글·채팅 메시지가 영구 삭제돼요. 되돌릴 수 없어요.</p>
            <div className="flex gap-2">
              <Link href="/settings" className="flex h-11 flex-1 items-center justify-center rounded-xl border border-lavender/35 text-[13px]">취소</Link>
              <form action={deleteMyContent} className="flex-1"><button className="h-11 w-full rounded-xl bg-danger text-[13px] font-semibold text-night">영구 삭제</button></form>
            </div>
          </div>
        ) : (
          <Link href="/settings?confirm=1" className="flex min-h-[52px] items-center rounded-2xl border border-danger/45 px-4 text-sm text-danger">내 감상과 대화 모두 삭제</Link>
        )}
      </section>
    </main>
  );
}
