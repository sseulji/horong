import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { requestFriend, respondChat, respondFriend } from "@/lib/actions";
import { Horong } from "@/components/Horong";
import { SectionTitle } from "@/components/ui";
import { STATUS_LABEL } from "@/lib/constants";

export const metadata = { title: "연결" };

const FRIEND_MSG: Record<string, string> = {
  sent: "친구 요청을 보냈어요.", notfound: "그 닉네임의 독자를 찾지 못했어요.", exists: "이미 요청했거나 친구예요.", empty: "닉네임을 입력해 주세요.",
};

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ friend?: string }> }) {
  const { friend } = await searchParams;
  const { supabase, user } = await requireUser();
  const [{ data: progress }, { data: requests }, { data: rooms }] = await Promise.all([
    supabase.rpc("friend_progress"),
    supabase.from("friendships").select("id, requester, addressee, status").eq("status", "pending"),
    supabase.from("chat_rooms").select("id, requester, addressee, status, expires_at, scene_idx, books(title)").in("status", ["requested", "open"]).order("created_at", { ascending: false }),
  ]);
  const others = [...new Set([...(requests ?? []).map((r) => (r.requester === user.id ? r.addressee : r.requester)), ...(rooms ?? []).map((r) => (r.requester === user.id ? r.addressee : r.requester))])];
  const { data: names } = others.length ? await supabase.from("public_profiles").select("id, nickname").in("id", others) : { data: [] };
  const nick = new Map((names ?? []).map((n) => [n.id, n.nickname as string]));

  type FP = { friend_id: string; nickname: string; book_id: string | null; title: string | null; status: string | null; current_scene: number | null; device_connected: boolean };
  const friends = new Map<string, FP[]>();
  ((progress ?? []) as FP[]).forEach((p) => friends.set(p.friend_id, [...(friends.get(p.friend_id) ?? []), p]));
  const now = Date.now();
  const liveRooms = (rooms ?? []).filter((r) => r.status === "requested" || (r.expires_at && new Date(r.expires_at).getTime() > now));

  return (
    <main className="flex flex-col gap-6 px-5 pb-8 pt-5">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[28px] font-bold">연결</h1>
        <p className="text-sm text-ink-2">같은 속도가 아니어도, 같은 책 위에서.</p>
      </header>

      {!!liveRooms.length && (
        <section aria-labelledby="h-chat" className="flex flex-col gap-2.5">
          <SectionTitle id="h-chat">30분 대화</SectionTitle>
          {liveRooms.map((r) => {
            const other = nick.get(r.requester === user.id ? r.addressee : r.requester) ?? "독자";
            const title = (r.books as unknown as { title: string } | null)?.title ?? "";
            if (r.status === "requested" && r.addressee === user.id) {
              return (
                <div key={r.id} className="flex flex-col gap-2.5 rounded-[18px] border border-blue/30 bg-blue/[0.06] px-4 py-3.5">
                  <span className="text-sm">{other}님이 『{title}』 장면 {r.scene_idx}에서 대화를 청했어요</span>
                  <div className="flex gap-2">
                    <form action={respondChat.bind(null, r.id, true)} className="flex-1"><button className="h-10 w-full rounded-full bg-flame text-[13px] font-semibold text-white">30분 대화 시작</button></form>
                    <form action={respondChat.bind(null, r.id, false)} className="flex-1"><button className="h-10 w-full rounded-full border border-lavender/30 text-[13px]">거절</button></form>
                  </div>
                </div>
              );
            }
            return (
              <Link key={r.id} href={`/chat/${r.id}`} className="flex items-center gap-3 rounded-[18px] border border-blue/30 bg-blue/[0.06] px-4 py-3.5">
                <span className="flex-1 text-sm">{r.status === "open" ? "진행 중" : "응답 기다리는 중"} · {other} · 『{title}』</span>
                <span className="text-xs text-blue">열기 ›</span>
              </Link>
            );
          })}
        </section>
      )}

      <section aria-labelledby="h-fr" className="flex flex-col gap-3">
        <SectionTitle id="h-fr">함께 읽는 친구</SectionTitle>
        {[...friends.entries()].map(([id, list]) => (
          <article key={id} className="flex items-center gap-3 rounded-[20px] border line bg-white/[0.04] p-4">
            <Horong state={list[0].device_connected ? "connect" : "idle"} size={40} />
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{list[0].nickname}</span>
              {list.filter((b) => b.book_id).map((b) => (
                <span key={b.book_id} className="text-xs text-ink-3">{b.title} · {b.current_scene ? `장면 ${b.current_scene}` : STATUS_LABEL[b.status ?? "reading"]}</span>
              ))}
              {!list.some((b) => b.book_id) && <span className="text-xs text-ink-3">지금 읽는 책 없음</span>}
            </div>
            <span className="text-[11px]" style={{ color: list[0].device_connected ? "#86B9FF" : "#A39FC9" }}>{list[0].device_connected ? "독서등 켜짐" : "앱만 사용"}</span>
          </article>
        ))}
        {!friends.size && <p className="text-sm text-ink-3">아직 함께 읽는 친구가 없어요.</p>}
        <p className="text-xs leading-relaxed text-ink-3">정확한 진도는 친구가 동의한 경우에만 보여요. 순위나 속도 비교는 없어요.</p>
      </section>

      <section aria-labelledby="h-req" className="flex flex-col gap-3">
        <SectionTitle id="h-req">친구 요청</SectionTitle>
        {(requests ?? []).map((r) => r.addressee === user.id ? (
          <div key={r.id} className="flex items-center gap-2.5 rounded-[18px] border line px-4 py-3">
            <span className="flex-1 text-sm">{nick.get(r.requester) ?? "독자"}님이 친구를 요청했어요</span>
            <form action={respondFriend.bind(null, r.id, true)}><button className="min-h-10 rounded-full bg-flame px-3.5 text-[13px] font-semibold text-white">수락</button></form>
            <form action={respondFriend.bind(null, r.id, false)}><button className="min-h-10 px-3 text-[13px] text-ink-2">거절</button></form>
          </div>
        ) : (
          <div key={r.id} className="flex items-center rounded-[18px] border line px-4 py-3 text-sm text-ink-2">
            <span className="flex-1">{nick.get(r.addressee) ?? "독자"}님에게 요청 보냄</span>
            <form action={respondFriend.bind(null, r.id, false)}><button className="min-h-10 px-2 text-xs">취소</button></form>
          </div>
        ))}
        <form action={requestFriend} className="flex gap-2">
          <label className="flex flex-1"><span className="sr-only-input">친구 닉네임</span>
            <input name="nickname" maxLength={24} placeholder="친구 닉네임으로 요청" className="h-12 min-w-0 flex-1 rounded-2xl border border-lavender/30 bg-white/5 px-4 text-sm outline-none placeholder:text-[#8F8AB8]" />
          </label>
          <button className="h-12 rounded-2xl border border-dashed border-lavender/45 px-4 text-sm text-pink">요청</button>
        </form>
        {friend && <p role="status" className="text-xs text-pink">{FRIEND_MSG[friend]}</p>}
      </section>
    </main>
  );
}
