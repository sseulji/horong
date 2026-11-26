"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Horong } from "@/components/Horong";
import { BackLink, btnPrimary, btnSecondary } from "@/components/ui";
import { publishQuestions } from "@/lib/actions";
import { QTYPE_LABEL } from "@/lib/constants";

type Q = { id: number; type: string; text: string; source: "ai" | "user"; selected: boolean };

export function QuestionStudio({ bookId, sceneIdx, sceneTitle }: { bookId: string; sceneIdx: number; sceneTitle: string }) {
  const [items, setItems] = useState<Q[]>([]);
  const [variant, setVariant] = useState(0);
  const [provider, setProvider] = useState<string>("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [published, setPublished] = useState(false);
  const [pending, start] = useTransition();

  const load = useCallback(async (v: number) => {
    setLoading(true); setError(""); setPublished(false);
    const res = await fetch("/api/questions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookId, sceneIdx, variant: v }) });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "질문을 만들지 못했어요"); return; }
    setProvider(data.provider);
    setNote(data.fallbackReason ?? "");
    setItems((data.questions as { type: string; text: string }[]).map((q, i) => ({ id: v * 10 + i, type: q.type, text: q.text, source: "ai", selected: i === 0 })));
  }, [bookId, sceneIdx]);

  useEffect(() => { load(0); }, [load]);

  const upd = (id: number, patch: Partial<Q>) => { setPublished(false); setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x))); };
  const selected = items.filter((q) => q.selected && q.text.trim());

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-6 pt-4">
      <header className="flex items-center gap-2">
        <BackLink href={`/books/${bookId}/scenes/${sceneIdx}`} label="장면 감상으로" />
        <h1 className="flex-1 text-base font-medium">대화의 계기</h1>
        {provider && <span className="rounded-full border border-lavender/35 px-2.5 py-1 text-[11px] text-ink-2">{provider === "anthropic" ? "AI 생성" : "샘플 질문 모드"}</span>}
      </header>

      <div className="flex items-center gap-3.5 rounded-[20px] bg-[radial-gradient(100%_120%_at_0%_50%,rgba(134,185,255,0.18),rgba(29,26,54,0.9))] p-4">
        <Horong state={loading ? "remember" : published ? "connect" : "receive"} size={64} />
        <p className="font-serif text-base leading-relaxed">정답 말고, 이야기를 시작할<br />질문을 골라 봤어요</p>
      </div>
      <p className="text-xs text-ink-3">장면 {String(sceneIdx).padStart(2, "0")} · {sceneTitle} 기준 · 내가 읽은 장면까지만 사용해요{note ? ` · ${note}` : ""}</p>

      {error && <p role="alert" className="rounded-xl border border-danger/50 px-3.5 py-3 text-sm text-danger">{error}</p>}
      {loading && <p aria-live="polite" className="text-sm text-ink-2">호롱이 질문을 고르는 중…</p>}

      <ol className="flex flex-1 flex-col gap-2.5">
        {items.map((q) => (
          <li key={q.id} className="flex flex-col gap-2.5 rounded-[18px] border p-4" style={{ background: q.selected ? "rgba(104,100,199,0.22)" : "rgba(255,255,255,0.05)", borderColor: q.selected ? "#A9A3EF" : "rgba(169,163,239,0.22)" }}>
            <div className="flex items-center gap-2 text-xs">
              {q.source === "ai" && <span className="rounded-full bg-blue px-2.5 py-0.5 font-semibold text-night">AI 발제문</span>}
              <span className="rounded-full border border-lavender/40 px-2.5 py-0.5">{QTYPE_LABEL[q.type] ?? "질문"}</span>
              <button type="button" onClick={() => setItems((xs) => xs.filter((x) => x.id !== q.id))} aria-label="이 질문 삭제" className="ml-auto size-9 text-ink-2">✕</button>
            </div>
            <label><span className="sr-only-input">질문 수정</span>
              <textarea value={q.text} onChange={(e) => upd(q.id, { text: e.target.value.slice(0, 300) })} rows={2}
                className="w-full resize-none bg-transparent font-serif text-[17px] leading-relaxed outline-none" />
            </label>
            <button type="button" aria-pressed={q.selected} onClick={() => upd(q.id, { selected: !q.selected })}
              className="min-h-9 self-start rounded-full border px-3.5 text-[13px]" style={{ borderColor: q.selected ? "#A9A3EF" : "rgba(169,163,239,0.3)" }}>
              {q.selected ? "선택됨" : "이 질문 선택"}
            </button>
          </li>
        ))}
        {!loading && items.length < 3 && (
          <li>
            <button type="button" onClick={() => setItems((xs) => [...xs, { id: Date.now(), type: "other", text: "", source: "user", selected: true }])}
              className="h-12 w-full rounded-[18px] border border-dashed border-lavender/40 text-sm text-pink">직접 질문 쓰기</button>
          </li>
        )}
      </ol>

      {published && (
        <p role="status" className="rounded-[14px] bg-blue/10 px-3.5 py-3 text-[13px] text-[#C9DDFF]">
          질문을 장면 {sceneIdx}에 남겼어요. 같은 장면의 독자에게 호롱이 알려줄게요. <Link href={`/books/${bookId}/scenes/${sceneIdx}`} className="underline">보러 가기</Link>
        </p>
      )}
      <div className="flex gap-2.5">
        <button type="button" disabled={loading} onClick={() => { const v = variant + 1; setVariant(v); load(v); }} className={`${btnSecondary} flex-1`}>다시 제안받기</button>
        <button type="button" disabled={!selected.length || pending || published}
          onClick={() => start(async () => { const r = await publishQuestions(bookId, sceneIdx, selected.map((q) => ({ text: q.text, type: q.type, source: q.source }))); if (r.ok) setPublished(true); else setError("공개하지 못했어요"); })}
          className={`${btnPrimary} flex-[1.3]`}>선택한 질문 공개</button>
      </div>
    </main>
  );
}
