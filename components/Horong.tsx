import { useId } from "react";
import { HORONG_LABEL, type HorongState } from "@/lib/constants";

/**
 * 호롱 캐릭터. 캐릭터 시트 기준: 위로 흐르는 불꽃 실루엣, 두 개의 발광 눈,
 * 반투명 젤리 질감, 보라·블루 발광, 몸 안쪽의 따뜻한 빛, 아래로 이어지는 꼬리.
 * 모션은 .hr-float / .hr-pulse (globals.css) — Reduce Motion 시 정지.
 */
export function Horong({ state = "idle", size = 120, showLabel = false, className = "" }: { state?: HorongState; size?: number; showLabel?: boolean; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const id = (n: string) => `${n}-${uid}`;
  const floating = state === "idle" || state === "connect" || state === "remember" || state === "receive";
  const halo = state === "receive" ? 1 : state === "focus" ? 0.3 : state === "sleep" ? 0.2 : 0.7;
  const warm = state === "receive" ? 0.6 : state === "sleep" ? 0.15 : 0.35;
  const eyeRy = state === "focus" ? 2.2 : state === "receive" ? 6.6 : 6;
  const eyeRx = state === "receive" ? 4.8 : 4.2;
  const label = `호롱 — ${HORONG_LABEL[state]}`;

  return (
    <span className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <span role="img" aria-label={label} className={floating ? "hr-float block" : "block"} style={{ width: size, height: Math.round(size * 1.25) }}>
        <svg viewBox="0 0 120 150" width={size} height={Math.round(size * 1.25)} aria-hidden="true" style={{ overflow: "visible", display: "block" }}>
          <defs>
            <radialGradient id={id("b")} cx="50%" cy="64%" r="62%">
              <stop offset="0" stopColor="#F7E4EE" />
              <stop offset="0.24" stopColor="#C6B6F4" />
              <stop offset="0.58" stopColor="#8A84DF" />
              <stop offset="1" stopColor="#5751B4" />
            </radialGradient>
            <linearGradient id={id("r")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#86B9FF" />
              <stop offset="1" stopColor="#E0B8F2" />
            </linearGradient>
            <radialGradient id={id("h")} cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#8E86F0" stopOpacity="0.6" />
              <stop offset="1" stopColor="#8E86F0" stopOpacity="0" />
            </radialGradient>
            <filter id={id("bl")} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" /></filter>
            <filter id={id("e")} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.2" /></filter>
          </defs>
          <circle cx="60" cy="80" r="62" fill={`url(#${id("h")})`} opacity={halo} className={state === "receive" ? "hr-pulse" : undefined} />
          {state === "remember" && (
            <g>
              <ellipse cx="60" cy="100" rx="50" ry="11" fill="none" stroke="#E0B8F2" strokeWidth="1.4" opacity="0.85" />
              <circle cx="108" cy="102" r="3" fill="#F3E8E5" />
              <circle cx="18" cy="96" r="2" fill="#E0B8F2" />
            </g>
          )}
          <path d="M56 110 C50 124 64 130 57 146 C70 134 63 122 69 110 Z" fill={`url(#${id("b")})`} opacity="0.75" />
          <path
            d="M60 6 C63 18 70 24 74 30 C78 24 79 18 78 13 C88 26 98 42 100 62 C103 92 84 116 60 116 C36 116 17 92 20 62 C22 44 32 30 42 21 C42 27 44 31 47 34 C50 24 56 16 60 6 Z"
            fill={`url(#${id("b")})`}
            opacity={state === "sleep" ? 0.7 : state === "focus" ? 0.85 : 0.94}
            stroke={`url(#${id("r")})`}
            strokeWidth="1.2"
            strokeOpacity="0.65"
          />
          <ellipse cx="60" cy="90" rx="22" ry="16" fill="#FBE9DD" opacity={warm} filter={`url(#${id("bl")})`} />
          <ellipse cx="42" cy="56" rx="6" ry="13" fill="#FFFFFF" opacity="0.16" transform="rotate(-22 42 56)" />
          {state !== "sleep" ? (
            <g>
              <ellipse cx="48" cy="80" rx="6" ry="8" fill="#E9E4FF" opacity="0.8" filter={`url(#${id("e")})`} />
              <ellipse cx="72" cy="80" rx="6" ry="8" fill="#E9E4FF" opacity="0.8" filter={`url(#${id("e")})`} />
              <ellipse cx="48" cy="80" rx={eyeRx} ry={eyeRy} fill="#FFFFFF" />
              <ellipse cx="72" cy="80" rx={eyeRx} ry={eyeRy} fill="#FFFFFF" />
            </g>
          ) : (
            <g fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round">
              <path d="M43 80 Q48 85 53 80" />
              <path d="M67 80 Q72 85 77 80" />
              <path d="M94 24 h8 l-8 9 h8" stroke="#C9C4E8" strokeWidth="1.8" strokeLinejoin="round" />
            </g>
          )}
          {state === "connect" && (
            <g>
              <path d="M92 52 C102 44 106 40 112 30" fill="none" stroke="#86B9FF" strokeWidth="1.4" strokeDasharray="2 4" strokeLinecap="round" />
              <path d="M116 16 C118 22 122 24 122 29 C122 34 119 36 116 36 C113 36 110 34 110 29 C110 24 114 22 116 16 Z" fill={`url(#${id("b")})`} stroke="#86B9FF" strokeWidth="0.8" />
            </g>
          )}
          {state === "receive" && (
            <path d="M60 -6 v-6 M24 10 l-5 -5 M96 10 l5 -5 M8 46 h-7 M112 46 h7" fill="none" stroke="#F3E8E5" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
          )}
        </svg>
      </span>
      {/* 빛만으로 상태를 전달하지 않는다 (PRD 11.4) */}
      {showLabel && <span className="text-xs text-ink-3">{HORONG_LABEL[state]}</span>}
    </span>
  );
}
