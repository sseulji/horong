"use client";
import Link from "next/link";
import { useState } from "react";
import { Horong } from "@/components/Horong";
import { btnPrimary } from "@/components/ui";
import type { HorongState } from "@/lib/constants";

const SLIDES: { kicker: string; state: HorongState; title: string; body: string }[] = [
  { kicker: "01 · 발견", state: "connect", title: "같은 문장에서\n마음을 발견하세요", body: "당신이 멈춘 장면에 머물렀던\n다른 독자의 감정과 질문이 남아 있어요." },
  { kicker: "02 · 속도", state: "idle", title: "각자의 속도로\n함께 읽으세요", body: "완독 기한도, 순위도 없어요.\n읽지 않은 장면의 이야기는 가려 둘게요." },
  { kicker: "03 · 빛", state: "receive", title: "빛이 알려주는\n새로운 이야기를 만나보세요", body: "새 질문이 도착하면 호롱이 조용히 밝아져요.\n언제든 연결을 멈출 수 있어요." },
];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const slide = SLIDES[Math.max(0, step - 1)];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-[radial-gradient(120%_60%_at_50%_38%,#2A2560_0%,#151326_62%)] px-7 pb-12 pt-6">
      {step === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-end gap-5 text-center">
          <Horong state="idle" size={168} className="mb-10" />
          <h1 className="font-serif text-[56px] font-bold tracking-tight">호롱</h1>
          <p className="mb-24 whitespace-pre-line font-serif text-[19px] leading-relaxed text-pink">{"같은 문장에 멈춘 사람을\n비추는 불"}</p>
          <button type="button" onClick={() => setStep(1)} className={`${btnPrimary} w-full`}>시작하기</button>
          <Link href="/login" className="flex min-h-11 items-center text-sm text-ink-2">이미 계정이 있어요 · 로그인</Link>
        </div>
      ) : (
        <>
          <div className="flex justify-end"><Link href="/login?mode=signup" className="flex min-h-11 items-center px-1 text-sm text-ink-2">건너뛰기</Link></div>
          <section key={step} className="hr-fade-in flex flex-1 flex-col items-center justify-center gap-7 text-center" aria-live="polite">
            <Horong state={slide.state} size={140} />
            <p className="text-xs tracking-[0.2em] text-lavender">{slide.kicker}</p>
            <h2 className="whitespace-pre-line font-serif text-[30px] leading-snug">{slide.title}</h2>
            <p className="whitespace-pre-line text-[15px] leading-7 text-ink-2">{slide.body}</p>
          </section>
          <div className="mb-7 flex justify-center gap-2" aria-label={`온보딩 ${step} / 3`}>
            {SLIDES.map((_, i) => <span key={i} className="h-1.5 rounded-full" style={{ width: i === step - 1 ? 22 : 6, background: i === step - 1 ? "#E0B8F2" : "#4A4580" }} />)}
          </div>
          {step < 3 ? (
            <button type="button" onClick={() => setStep(step + 1)} className={btnPrimary}>다음</button>
          ) : (
            <Link href="/login?mode=signup" className={btnPrimary}>이메일로 시작하기</Link>
          )}
        </>
      )}
    </main>
  );
}
