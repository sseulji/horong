"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Horong } from "@/components/Horong";
import { BackLink, btnPrimary } from "@/components/ui";
import { blockUser, closeChat, reportContent } from "@/lib/actions";

type Msg = { id: string; user_id: string; body: string; created_at: string };

export function ChatRoom({ room, me, otherId, otherName, initial }: {
  room: { id: string; bookId: string; sceneIdx: number; status: string; expiresAt: string | null; bookTitle: string; sceneTitle: string };
  me: string; otherId: string; otherName: string; initial: Msg[];
}) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [draft, setDraft] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [ended, setEnded] = useState(room.status === "closed" || room.status === "declined");
  const [summary, setSummary] = useState("");
  const [saved, setSaved] = useState<null | boolean>(null);
  const [notice, setNotice] = useState("");
  const [pending, start] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  const expiresAt = room.expiresAt ? new Date(room.expiresAt).getTime() : null;
  const left = expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : null;
  const open = room.status === "open" && left !== null && left > 0 && !ended;

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const ch = supabase
      .channel(`room:${room.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${room.id}` }, (p) => {
        const m = p.new as Msg;
        setMsgs((xs) => (xs.some((x) => x.id === m.id) ? xs : [...xs, m]));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, room.id]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [msgs.length]);

  const send = async (text: string) => {
    const body = text.trim().slice(0, 500);
    if (!body || !open) return;
    setDraft("");
    const { data, error } = await supabase.from("chat_messages").insert({ room_id: room.id, user_id: me, body }).select("id, user_id, body, created_at").single();
    if (error) setNotice("메시지를 보낼 수 없어요. 대화 시간이 끝났을 수 있어요.");
    else if (data) setMsgs((xs) => (xs.some((x) => x.id === data.id) ? xs : [...xs, data]));
  };

  const mm = left !== null ? String(Math.floor(left / 60)).padStart(2, "0") : "--";
  const ss = left !== null ? String(left % 60).padStart(2, "0") : "--";
  const clock = room.status === "requested" ? "수락 대기" : left === 0 || ended ? "입력 종료" : `${mm}:${ss}`;

  if (ended || (room.status === "open" && left === 0)) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 py-8 text-center">
        <Horong state="sleep" size={120} />
        <p className="font-serif text-[21px]">짧은 대화가 끝났어요</p>
        <p className="text-sm text-ink-2">대화를 내 기록으로 남길지 선택할 수 있어요. 남기면 ‘나만 보기’ 감상으로 저장되고, 상대의 메시지 원문은 저장하지 않아요.</p>
        {saved === null && (
          <>
            <label className="w-full text-left text-sm">한 줄 요약
              <textarea value={summary} onChange={(e) => setSummary(e.target.value.slice(0, 500))} rows={3} placeholder="이 대화에서 남기고 싶은 생각"
                className="mt-2 w-full resize-none rounded-2xl border border-lavender/30 bg-white/5 px-4 py-3 text-[15px] outline-none placeholder:text-[#8F8AB8]" />
            </label>
            <div className="flex w-full gap-2.5">
              <button type="button" disabled={!summary.trim() || pending} onClick={() => start(async () => { await closeChat(room.id, { bookId: room.bookId, sceneIdx: room.sceneIdx, summary }); setSaved(true); })}
                className="h-12 flex-1 rounded-full border border-lavender text-sm disabled:opacity-40">내 감상으로 저장</button>
              <button type="button" disabled={pending} onClick={() => start(async () => { await closeChat(room.id, null); setSaved(false); })}
                className="h-12 flex-1 rounded-full border border-lavender/30 text-sm text-ink-2">저장하지 않기</button>
            </div>
          </>
        )}
        {saved !== null && <p role="status" className="text-sm text-pink">{saved ? "나만 보기 감상으로 저장했어요." : "대화 내용은 저장하지 않았어요."}</p>}
        <Link href={`/read/${room.bookId}`} className={`${btnPrimary} w-full`}>읽던 책으로 돌아가기</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col">
      <header className="flex items-center gap-2 border-b line px-3 py-3">
        <BackLink href="/connect" label="연결로" />
        <div className="flex flex-1 flex-col">
          <span className="text-[15px] font-semibold">{otherName}</span>
          <span className="text-xs text-ink-3">{room.bookTitle} · 장면 {String(room.sceneIdx).padStart(2, "0")} {room.sceneTitle}</span>
        </div>
        <span role="timer" aria-label={`남은 시간 ${clock}`} className="rounded-full border px-3 py-1.5 text-[13px] tabular-nums"
          style={{ borderColor: left !== null && left < 300 ? "#E0B8F2" : "rgba(169,163,239,0.35)", color: left !== null && left < 300 ? "#E0B8F2" : "#C9C4E8" }}>{clock}</span>
      </header>

      <div ref={listRef} aria-live="polite" className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-4">
        <p className="mb-1.5 self-center text-center text-xs text-ink-3">
          {room.status === "requested" ? `${otherName}님이 수락하면 30분 대화가 열려요.` : "이 대화는 30분 뒤 입력이 닫혀요. 언제든 먼저 나가도 괜찮아요."}
        </p>
        {msgs.map((m) => {
          const mine = m.user_id === me;
          return (
            <p key={m.id} className={`max-w-[78%] px-3.5 py-2.5 text-sm leading-relaxed ${mine ? "self-end rounded-[18px_18px_6px_18px] bg-flame text-white" : "self-start rounded-[18px_18px_18px_6px] bg-surface-2"}`}>{m.body}</p>
          );
        })}
      </div>

      {notice && <p role="alert" className="px-4 text-xs text-danger">{notice}</p>}
      <div className="flex flex-wrap gap-1.5 px-4 pb-2">
        {["공감해요", "위로가 돼요", "궁금해요"].map((r) => (
          <button key={r} type="button" disabled={!open} onClick={() => send(r)} className="min-h-9 rounded-full border border-pink/45 px-3 text-xs text-pink disabled:opacity-40">{r}</button>
        ))}
        <button type="button" onClick={() => setEnded(true)} className="ml-auto min-h-9 rounded-full border border-lavender/35 px-3 text-xs text-ink-2">대화 종료</button>
      </div>
      <div className="flex gap-1.5 px-4 pb-2 text-[11px] text-ink-3">
        <button type="button" className="min-h-8 underline" onClick={() => start(async () => { const r = await reportContent("user", otherId, "채팅 중 부적절한 행동"); setNotice(r.ok ? "신고가 접수됐어요." : "신고하지 못했어요."); })}>상대 신고</button>
        <button type="button" className="min-h-8 underline" onClick={() => start(async () => { await blockUser(otherId); await closeChat(room.id, null); router.push("/connect"); })}>차단하고 나가기</button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(draft); }} className="flex gap-2 px-4 pb-6 pt-1">
        <label className="flex flex-1"><span className="sr-only-input">메시지</span>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} disabled={!open} maxLength={500} placeholder={open ? "이 장면에 대해 이야기해요" : "지금은 입력할 수 없어요"}
            className="h-12 min-w-0 flex-1 rounded-full border border-lavender/30 bg-white/5 px-4 text-sm outline-none placeholder:text-[#8F8AB8]" />
        </label>
        <button type="submit" disabled={!open || !draft.trim()} aria-label="보내기" className="inline-flex size-12 items-center justify-center rounded-full bg-flame text-white disabled:bg-track">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </form>
    </main>
  );
}
