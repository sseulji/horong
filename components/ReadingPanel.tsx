"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Horong } from "@/components/Horong";
import { BackLink } from "@/components/ui";
import { useDevice } from "@/components/AppShell";
import { endSession, saveDevice, setScene, startSession } from "@/lib/actions";
import type { HorongState } from "@/lib/constants";

export function ReadingPanel({ book, scenes, initialScene, sceneNoteCount, sessionId }: {
  book: { id: string; title: string; author: string };
  scenes: { idx: number; title: string }[];
  initialScene: number;
  sceneNoteCount: number;
  sessionId: string | null;
}) {
  const { device, status } = useDevice();
  const [scene, setSceneState] = useState(initialScene);
  const [focus, setFocus] = useState(status.focusMode);
  const [done, setDone] = useState(false);
  const [, start] = useTransition();
  const session = useRef<string | null>(sessionId);
  const total = scenes.length || 1;

  // 독서 모드 시작 → 세션 기록 + 독서등 동기화 (PRD F02)
  useEffect(() => {
    if (!session.current) startSession(book.id, "home").then((id) => { session.current = id ?? null; });
    if (status.connected && !status.focusMode) device.setLightState("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const move = (d: number) => {
    const n = Math.min(total, Math.max(1, scene + d));
    setSceneState(n);
    setDone(false);
    start(() => setScene(book.id, n));
  };
  const toggleFocus = async () => {
    const on = !focus;
    setFocus(on);
    setDone(false);
    await device.setFocusMode(on);
    start(() => saveDevice({ ...device.getDeviceStatus() }, "focus", { on }));
  };
  const finish = async () => {
    setDone(true);
    setFocus(false);
    if (status.connected) await device.setLightState("sleep");
    if (session.current) start(() => endSession(session.current!, book.id, scene));
  };

  const hState: HorongState = done ? "sleep" : focus ? "focus" : "idle";
  const name = scenes.find((s) => s.idx === scene)?.title ?? `장면 ${scene}`;
  const message = done
    ? `장면 ${scene}에 책갈피를 꽂아 두었어요.\n편히 쉬어요.`
    : focus
      ? "집중 모드예요.\n도착한 이야기는 나중에 알려드릴게요."
      : scene === initialScene && sceneNoteCount > 0
        ? `천천히 읽어요.\n이 장면에 머문 마음이 ${sceneNoteCount}개 있어요.`
        : "천천히 읽어요.\n인상 깊은 장면에서 멈춰도 좋아요.";

  return (
    <main className={`mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-7 pt-4 ${focus ? "bg-night-deep" : ""}`}>
      <header className="flex items-center gap-2">
        <BackLink href="/home" label="홈으로" />
        <div className="flex flex-1 flex-col">
          <span className="font-serif text-[17px]">{book.title}</span>
          <span className="text-xs text-ink-3">{book.author} · 종이책과 함께</span>
        </div>
        <Link href="/device" className="text-xs" style={{ color: status.connected ? (focus ? "#A39FC9" : "#86B9FF") : "#A39FC9" }}>
          {status.connected ? (focus ? "독서등 · 알림 억제" : "독서등 · 독서 조명") : "독서등 없음"}
        </Link>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Horong state={hState} size={150} showLabel />
        <p aria-live="polite" className="whitespace-pre-line font-serif text-[19px] leading-relaxed">{message}</p>
      </div>

      <section aria-label="현재 독서 위치" className="glass flex items-center gap-3 rounded-[20px] px-4 py-3.5">
        <button type="button" onClick={() => move(-1)} disabled={scene <= 1} aria-label="이전 장면" className="size-11 rounded-full border border-lavender/35 text-lg disabled:opacity-40">−</button>
        <div className="flex-1 text-center">
          <p className="text-xs tracking-[0.14em] text-lavender">SCENE {String(scene).padStart(2, "0")} / {total}</p>
          <p className="mt-0.5 font-serif text-[17px]">{name}</p>
        </div>
        <button type="button" onClick={() => move(1)} disabled={scene >= total} aria-label="다음 장면" className="size-11 rounded-full border border-lavender/35 text-lg disabled:opacity-40">+</button>
      </section>

      <div className="grid grid-cols-3 gap-2.5">
        <Link href={`/read/${book.id}/record?scene=${scene}`} className="flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-[18px] bg-flame text-[13px] font-semibold text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>구절 기록
        </Link>
        <Link href={`/books/${book.id}/scenes/${scene}`} className="glass flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-[18px] text-[13px]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="8" cy="12" r="3" /><circle cx="17" cy="12" r="3" /></svg>감상 발견
        </Link>
        <Link href={`/books/${book.id}/scenes/${scene}/questions`} className="glass flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-[18px] text-[13px]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M9 9a3 3 0 1 1 4 2.8c-.8.4-1 .9-1 1.7M12 17h.01" /></svg>질문 발견
        </Link>
      </div>

      <div className="flex gap-2.5">
        <button type="button" role="switch" aria-checked={focus} onClick={toggleFocus}
          className={`h-[52px] flex-1 rounded-full border border-lavender/35 text-sm font-medium ${focus ? "bg-track" : ""}`}>집중 모드 {focus ? "켜짐" : "꺼짐"}</button>
        <button type="button" onClick={finish} className="h-[52px] flex-1 rounded-full bg-ivory text-sm font-semibold text-night">독서 마무리</button>
      </div>
    </main>
  );
}
