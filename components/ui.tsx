import Link from "next/link";
import { emotionLabel, emotionTone } from "@/lib/constants";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={label} className="inline-flex size-11 items-center justify-center rounded-full text-ivory hover:bg-white/5">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
    </Link>
  );
}

export function SectionTitle({ id, children }: { id?: string; children: React.ReactNode }) {
  return <h2 id={id} className="text-[13px] font-medium tracking-[0.14em] text-lavender">{children}</h2>;
}

export function EmotionBadge({ id }: { id: string }) {
  const tone = emotionTone(id);
  return (
    <span className="rounded-full border px-2.5 py-0.5 text-xs" style={{ borderColor: tone, color: tone }}>
      {emotionLabel(id)}
    </span>
  );
}

/** 장면 단위 진도 세그먼트 */
export function SceneProgress({ total, current }: { total: number; current?: number | null }) {
  const n = Math.min(total, 20);
  return (
    <div className="flex gap-1" role="img" aria-label={current ? `${total}개 장면 중 ${current}번째까지 읽음` : "진도 입력 안 함"}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="h-1 flex-1 rounded-sm" style={{ background: current && i + 1 < current ? "#A9A3EF" : current && i + 1 === current ? "#E0B8F2" : "#3A3566" }} />
      ))}
    </div>
  );
}

export function BookCover({ title, url, className = "w-16 h-[92px]" }: { title: string; url?: string | null; className?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`${className} shrink-0 rounded-md object-cover`} />;
  }
  return (
    <div className={`${className} flex shrink-0 items-end rounded-md bg-gradient-to-br from-[#3B3580] to-[#231F4A] p-2 font-serif text-[11px] leading-tight`} aria-hidden="true">
      {title}
    </div>
  );
}

export const btnPrimary = "inline-flex h-[52px] items-center justify-center rounded-full bg-flame px-6 text-[15px] font-semibold text-white shadow-glow-flame disabled:bg-track disabled:shadow-none";
export const btnSecondary = "inline-flex h-[52px] items-center justify-center rounded-full border border-lavender/35 px-6 text-[15px] text-ivory hover:bg-white/5";
export const btnSmall = "inline-flex min-h-10 items-center justify-center rounded-full border border-lavender/30 px-3.5 text-[13px] text-ivory hover:bg-white/5";
