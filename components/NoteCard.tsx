"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addComment, blockUser, deleteNote, reportContent, requestChat, toggleEmpathy } from "@/lib/actions";
import { EmotionBadge } from "@/components/ui";

export type NoteView = {
  id: string; user_id: string; nickname: string; scene_idx: number; emotions: string[]; body: string | null;
  quote: string | null; description: string | null; visibility: string; created_at: string;
  empathy_count: number; comment_count: number; i_empathized: boolean; is_spoiler: boolean; is_mine: boolean;
};

export function NoteCard({ note, comments, path, bookId, sceneIdx }: {
  note: NoteView; comments: { id: string; body: string; nickname: string; mine: boolean }[]; path: string; bookId: string; sceneIdx: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [menu, setMenu] = useState(false);
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState("");

  if (note.is_spoiler && note.body === null && note.quote === null && note.description === null) {
    return (
      <article className="relative overflow-hidden rounded-[20px] border line px-4 py-4">
        <p aria-hidden="true" className="text-[15px] leading-relaxed text-ink-2 blur-[7px]">아직 읽지 않은 장면의 감상이 이곳에 가려져 있어요</p>
        <p className="absolute inset-0 flex items-center justify-center bg-night/60 text-[13px]">{note.nickname}님의 감상 · 내 진도 이후</p>
      </article>
    );
  }

  return (
    <article className="flex flex-col gap-2.5 rounded-[20px] border line bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-[13px]">
        <span className="inline-flex size-[30px] items-center justify-center rounded-full bg-track text-xs" aria-hidden="true">{note.nickname[0]}</span>
        <span>{note.is_mine ? `${note.nickname} (나)` : note.nickname}</span>
        <div className="flex flex-wrap gap-1">{note.emotions.map((e) => <EmotionBadge key={e} id={e} />)}</div>
        <button type="button" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label={note.is_mine ? "더보기: 삭제" : "더보기: 신고 또는 차단"} className="ml-auto size-10 text-lg text-ink-2">···</button>
      </div>

      {menu && (
        <div className="flex gap-2">
          {note.is_mine ? (
            <button type="button" disabled={pending} onClick={() => start(() => deleteNote(note.id, path))} className="h-10 flex-1 rounded-xl border border-danger text-[13px] text-danger">내 감상 삭제</button>
          ) : (
            <>
              <button type="button" disabled={pending} onClick={() => start(async () => { const r = await reportContent("note", note.id, "부적절한 감상"); setMsg(r.ok ? "신고가 접수됐어요. 검토 후 조치할게요." : "신고하지 못했어요."); setMenu(false); })}
                className="h-10 flex-1 rounded-xl border border-danger text-[13px] text-danger">부적절한 감상 신고</button>
              <button type="button" disabled={pending} onClick={() => start(() => blockUser(note.user_id, path))} className="h-10 flex-1 rounded-xl border border-lavender/40 text-[13px]">이 독자 차단</button>
            </>
          )}
        </div>
      )}
      {msg && <p role="status" className="text-xs text-pink">{msg}</p>}

      {(note.quote || note.description) && (
        <blockquote className="border-l-0 rounded-xl bg-flame/10 px-3.5 py-2.5 font-serif text-[15px] leading-relaxed text-ink-2">
          {note.quote ? `“${note.quote}”` : note.description}
        </blockquote>
      )}
      {note.body && <p className="text-[15px] leading-relaxed">{note.body}</p>}

      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" aria-pressed={note.i_empathized} disabled={pending || note.is_mine}
          onClick={() => start(() => toggleEmpathy(note.id, !note.i_empathized, path))}
          className="min-h-10 rounded-full border px-3 text-[13px] disabled:opacity-60"
          style={{ borderColor: note.i_empathized ? "#E0B8F2" : "rgba(169,163,239,0.3)", background: note.i_empathized ? "rgba(224,184,242,0.2)" : "transparent" }}>
          공감 {note.empathy_count}
        </button>
        <button type="button" aria-expanded={replying} onClick={() => setReplying(!replying)} className="min-h-10 rounded-full border border-lavender/30 px-3 text-[13px]">답글 {note.comment_count}</button>
        {!note.is_mine && (
          <button type="button" disabled={pending} className="ml-auto min-h-10 text-xs text-blue"
            onClick={() => start(async () => { const r = await requestChat(bookId, sceneIdx, note.user_id); if (r.ok) router.push(`/chat/${r.roomId}`); else setMsg(r.error); })}>
            30분 대화 요청
          </button>
        )}
      </div>

      {replying && (
        <div className="flex flex-col gap-2">
          {comments.map((c) => (
            <p key={c.id} className="rounded-xl bg-surface-1 px-3.5 py-2.5 text-sm leading-relaxed"><span className="mr-2 text-xs text-ink-3">{c.mine ? "나" : c.nickname}</span>{c.body}</p>
          ))}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const body = draft; start(async () => { const r = await addComment(note.id, body, path); if (r.ok) setDraft(""); }); }}>
            <label className="flex flex-1"><span className="sr-only-input">답글 입력</span>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} placeholder="천천히 답해도 괜찮아요"
                className="h-11 min-w-0 flex-1 rounded-xl border border-lavender/30 bg-white/5 px-3.5 text-sm outline-none placeholder:text-[#8F8AB8]" />
            </label>
            <button type="submit" disabled={pending || !draft.trim()} className="h-11 rounded-xl bg-flame px-4 text-[13px] font-semibold text-white disabled:bg-track">보내기</button>
          </form>
        </div>
      )}
    </article>
  );
}
