"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Horong } from "@/components/Horong";
import { BackLink, btnPrimary } from "@/components/ui";
import { useDevice } from "@/components/AppShell";
import { createNote } from "@/lib/actions";
import { EMOTIONS, VISIBILITY, type Visibility } from "@/lib/constants";

type Mode = "hand_sim" | "quote" | "scene";

export function RecordFlow({ book, scenes, initialScene, defaultVisibility, simPage }: {
  book: { id: string; title: string };
  scenes: { idx: number; title: string }[];
  initialScene: number;
  defaultVisibility: Visibility;
  simPage: { scene: number; lines: string[] } | null;
}) {
  const { device, status } = useDevice();
  const [step, setStep] = useState<"passage" | "emotion" | "saved">("passage");
  const [scene, setScene] = useState(initialScene);
  const [mode, setMode] = useState<Mode>(simPage && simPage.scene === initialScene ? "hand_sim" : "quote");
  const [lines, setLines] = useState<number[]>([]);
  const [text, setText] = useState("");
  const [emotions, setEmotions] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [vis, setVis] = useState<Visibility>(defaultVisibility);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const simAvailable = !!simPage && simPage.scene === scene;
  const passage = mode === "hand_sim" ? [...lines].sort((a, b) => a - b).map((i) => simPage!.lines[i]).join(" ") : text.trim();
  const ready = passage.length > 0;
  const sceneTitle = scenes.find((s) => s.idx === scene)?.title ?? `장면 ${scene}`;

  const save = () => {
    const fd = new FormData();
    fd.set("bookId", book.id);
    fd.set("sceneIdx", String(scene));
    fd.set("kind", mode);
    if (mode === "scene") fd.set("description", passage); else fd.set("quote", passage);
    fd.set("body", note);
    fd.set("visibility", vis);
    emotions.forEach((e) => fd.append("emotions", e));
    setError("");
    start(async () => {
      const res = await createNote(fd);
      if (!res.ok) { setError(res.error); return; }
      setStep("saved");
      if (status.connected && !status.focusMode) {
        await device.setLightState("remember");
        setTimeout(() => device.setLightState("idle"), 2400);
      }
    });
  };

  const tab = (m: Mode, label: string, disabled = false) => (
    <button key={m} type="button" role="tab" aria-selected={mode === m} disabled={disabled} onClick={() => setMode(m)}
      className={`h-10 rounded-full text-[13px] font-medium disabled:opacity-40 ${mode === m ? "bg-flame text-white" : "text-ink-2"}`}>{label}</button>
  );

  if (step === "saved") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5 pb-8 pt-4">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <Horong state="remember" size={150} />
          <p role="status" className="font-serif text-[22px] leading-relaxed">호롱이 이 마음을<br />기억했어요</p>
          <p className="text-sm text-ink-2">{emotions.map((e) => EMOTIONS.find((x) => x.id === e)?.label).join(" · ") || "감정 없이"} — {VISIBILITY.find((v) => v.id === vis)?.label}</p>
        </div>
        <Link href={`/books/${book.id}/scenes/${scene}`} className={btnPrimary}>같은 장면의 다른 마음 보기</Link>
        <Link href={`/read/${book.id}`} className="flex h-12 items-center justify-center text-sm text-ink-2">책으로 돌아가기</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-6 pt-4">
      <header className="flex items-center gap-2">
        {step === "passage"
          ? <BackLink href={`/read/${book.id}`} label="독서 모드로" />
          : <button type="button" onClick={() => setStep("passage")} aria-label="구절 선택으로" className="inline-flex size-11 items-center justify-center"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg></button>}
        <h1 className="flex-1 font-serif text-[22px]">{step === "passage" ? "어느 장면에 멈췄나요?" : "어떤 마음이 들었나요?"}</h1>
        <Horong state={ready ? "remember" : "idle"} size={44} />
      </header>

      {step === "passage" && (
        <>
          <label className="flex items-center gap-3 text-sm">장면
            <select value={scene} onChange={(e) => {
              const n = Number(e.target.value);
              setScene(n);
              setLines([]);
              if (mode === "hand_sim" && !(simPage && simPage.scene === n)) setMode("quote");
            }} className="h-11 flex-1 rounded-xl border border-lavender/30 bg-surface-1 px-3 text-ivory">
              {scenes.map((s) => <option key={s.idx} value={s.idx}>{s.idx}. {s.title}</option>)}
            </select>
          </label>
          <div role="tablist" aria-label="기록 방법" className="grid grid-cols-3 gap-1.5 rounded-full bg-surface-1 p-1">
            {tab("hand_sim", "손 하이라이트", !simAvailable)}{tab("quote", "구절 입력")}{tab("scene", "장면 설명")}
          </div>
          <p className="text-xs text-lavender">책에 밑줄을 긋지 않아도 괜찮아요</p>

          {mode === "hand_sim" && simAvailable ? (
            <div className="flex flex-1 flex-col gap-2.5">
              <p className="rounded-xl border border-blue/30 bg-blue/10 px-3 py-2.5 text-xs leading-relaxed text-[#C9DDFF]">손 하이라이트는 기술 검증 전 기능이에요. 지금은 책 위를 손가락으로 따라가는 동작을 줄 단위 탭으로 시뮬레이션합니다.</p>
              <div className="flex flex-1 flex-col gap-0.5 rounded-2xl bg-ivory px-4 py-5 text-[#2A2540]">
                {simPage!.lines.map((l, i) => {
                  const on = lines.includes(i);
                  return (
                    <button key={i} type="button" aria-pressed={on} onClick={() => setLines(on ? lines.filter((x) => x !== i) : [...lines, i])}
                      className="min-h-11 rounded-md px-2 py-1.5 text-left font-serif text-[17px] leading-relaxed" style={{ background: on ? "rgba(104,100,199,0.28)" : "transparent" }}>{l}</button>
                  );
                })}
              </div>
            </div>
          ) : (
            <label className="flex flex-1 flex-col gap-2 text-[13px] text-ink-2">
              {mode === "quote" ? "책의 구절을 짧게 옮겨 주세요 (300자 이내)" : "어떤 장면이었는지 떠올려 설명해 주세요"}
              <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 300))} rows={6}
                placeholder={mode === "quote" ? "인상 깊었던 한두 문장" : "예: 주인공이 비를 맞으며 첫 손님을 태우는 장면"}
                className="flex-1 resize-none rounded-2xl border border-lavender/30 bg-white/5 p-4 font-serif text-[17px] leading-relaxed text-ivory outline-none placeholder:text-[#8F8AB8]" />
            </label>
          )}
          <div className="flex min-h-16 flex-col gap-1.5 rounded-2xl bg-surface-1 px-4 py-3.5">
            <span className="text-xs text-ink-3">선택한 구절 · 장면 {scene} {sceneTitle}</span>
            <span className="font-serif text-[15px] leading-relaxed">{passage || "아직 선택하지 않았어요"}</span>
          </div>
          <button type="button" disabled={!ready} onClick={() => setStep("emotion")} className={btnPrimary}>이 장면으로 감정 기록하기</button>
        </>
      )}

      {step === "emotion" && (
        <>
          <blockquote className="rounded-[20px] bg-gradient-to-b from-flame/25 to-flame/10 px-5 py-4 font-serif text-[17px] leading-[1.8]">
            {passage}
            <span className="mt-1.5 block font-sans text-xs text-lavender">장면 {String(scene).padStart(2, "0")} · {sceneTitle}</span>
          </blockquote>
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-sm font-medium">감정 태그 <span className="font-normal text-ink-3">선택 · 최대 3개 · {emotions.length}/3</span></legend>
            <div className="flex flex-wrap gap-2">
              {EMOTIONS.map((e) => {
                const on = emotions.includes(e.id);
                return (
                  <button key={e.id} type="button" aria-pressed={on} disabled={!on && emotions.length >= 3}
                    onClick={() => setEmotions(on ? emotions.filter((x) => x !== e.id) : [...emotions, e.id])}
                    className="h-10 rounded-full border px-4 text-sm font-medium disabled:opacity-40"
                    style={{ background: on ? "#E0B8F2" : "transparent", color: on ? "#151326" : "#F3E8E5", borderColor: on ? "#E0B8F2" : "rgba(169,163,239,0.4)" }}>
                    {on ? "✓ " : ""}{e.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label className="flex flex-col gap-2 text-sm font-medium">짧은 감상 <span className="text-xs font-normal text-ink-3">선택 · {note.length}/140</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 140))} rows={3} placeholder="한 줄이면 충분해요"
              className="resize-none rounded-2xl border border-lavender/30 bg-white/5 px-4 py-3.5 text-[15px] font-normal text-ivory outline-none placeholder:text-[#8F8AB8]" />
          </label>
          <fieldset>
            <legend className="mb-2.5 text-sm font-medium">공개 범위</legend>
            <div className="grid grid-cols-3 gap-2">
              {VISIBILITY.map((v) => (
                <button key={v.id} type="button" aria-pressed={vis === v.id} onClick={() => setVis(v.id)}
                  className={`h-11 rounded-[14px] border text-[13px] ${vis === v.id ? "border-lavender bg-flame/35" : "border-lavender/30"}`}>{v.label}</button>
              ))}
            </div>
          </fieldset>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button type="button" onClick={save} disabled={pending} className={`${btnPrimary} mt-auto`}>{pending ? "기억하는 중…" : "호롱에게 기억시키기"}</button>
        </>
      )}
    </main>
  );
}
