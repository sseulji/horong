"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MockDeviceProvider, type DeviceProvider, type DeviceStatus } from "@/lib/device/provider";
import { Horong } from "@/components/Horong";
import type { HorongState } from "@/lib/constants";

// ------------------------------------------------------------ device context
type DeviceCtx = { device: DeviceProvider; status: DeviceStatus; lastEvent: string };
const Ctx = createContext<DeviceCtx | null>(null);
export function useDevice() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDevice outside AppShell");
  return v;
}

const TABS = [
  { href: "/home", label: "홈", match: ["/home", "/resume", "/read"], d: "M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-4 0-7zM6 21h12" },
  { href: "/discover", label: "발견", match: ["/discover", "/books"], d: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" },
  { href: "/connect", label: "연결", match: ["/connect", "/chat"], d: "M7 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9.5 10.5l5 3" },
  { href: "/library", label: "MY", match: ["/library", "/settings", "/device"], d: "M5 4h5v16H5zM12 4h3v16h-3zM17 5l3 .6-2.6 14.6-3-.6" },
];

const NOTI_TEXT: Record<string, string> = {
  comment: "내 감상에 답글이 도착했어요",
  question: "머물렀던 장면에 새 질문이 도착했어요",
  reaction: "누군가 내 감상에 공감했어요",
  chat_request: "같은 장면의 독자가 30분 대화를 요청했어요",
  chat_open: "대화 요청이 수락됐어요",
  friend_request: "새 친구 요청이 있어요",
};

export function AppShell({
  children, userId, reduceMotion, lightNotifications, device: initial,
}: {
  children: React.ReactNode; userId: string; reduceMotion: boolean; lightNotifications: boolean;
  device: { connected: boolean; brightness: number; focusMode: boolean; lightState: string } | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const providerRef = useRef<DeviceProvider | null>(null);
  if (!providerRef.current) {
    providerRef.current = new MockDeviceProvider(
      initial ? { connected: initial.connected, brightness: initial.brightness, focusMode: initial.focusMode, lightState: initial.lightState as HorongState } : undefined,
    );
  }
  const device = providerRef.current;
  const [status, setStatus] = useState(device.getDeviceStatus());
  const [lastEvent, setLastEvent] = useState("");
  const [toast, setToast] = useState<{ text: string; href: string } | null>(null);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
  }, [reduceMotion]);

  useEffect(() => device.subscribe((s, e) => { setStatus(s); setLastEvent(e.type); }), [device]);

  // 알림 실시간 수신 → 토스트 + (설정 시) 독서등 빛 반응
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        const n = payload.new as { kind: string; book_id: string | null; scene_idx: number | null; ref_id: string | null };
        const href = n.kind === "chat_request" || n.kind === "friend_request" ? "/connect" : n.kind === "chat_open" && n.ref_id ? `/chat/${n.ref_id}` : n.book_id ? `/resume/${n.book_id}` : "/home";
        setToast({ text: NOTI_TEXT[n.kind] ?? "새로운 이야기가 도착했어요", href });
        if (lightNotifications) device.signal(n.kind === "question" ? "question_arrived" : n.kind === "chat_open" ? "connected_reader" : "opinion_arrived");
        router.refresh();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, lightNotifications, device, router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const ctx = useMemo(() => ({ device, status, lastEvent }), [device, status, lastEvent]);
  const immersive = pathname.startsWith("/read") || pathname.startsWith("/chat");

  return (
    <Ctx.Provider value={ctx}>
      <div className="md:flex md:min-h-dvh">
        <nav aria-label="주요 메뉴" className={`${immersive ? "hidden md:flex" : "flex"} fixed inset-x-0 bottom-0 z-20 grid-cols-4 border-t line bg-night/95 px-3 pb-5 pt-2 backdrop-blur md:sticky md:top-0 md:h-dvh md:w-56 md:flex-col md:gap-1 md:border-r md:border-t-0 md:px-4 md:pt-8`}>
          <Link href="/home" className="mb-6 hidden items-center gap-2 px-3 font-serif text-2xl md:flex"><Horong state={status.lightState} size={28} />호롱</Link>
          <div className="grid w-full grid-cols-4 md:flex md:flex-col md:gap-1">
            {TABS.map((t) => {
              const active = t.match.some((m) => pathname.startsWith(m));
              return (
                <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
                  className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-2xl text-[11px] md:flex-row md:justify-start md:gap-3 md:px-3 md:text-[15px] ${active ? "font-semibold text-ivory md:bg-white/5" : "text-[#8F8AB8] hover:text-ivory"}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={t.d} /></svg>
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>
        <div className={`mx-auto w-full max-w-2xl flex-1 ${immersive ? "" : "pb-28 md:pb-10"}`}>{children}</div>
      </div>
      {toast && (
        <Link href={toast.href} role="status" onClick={() => setToast(null)}
          className="hr-fade-in fixed inset-x-4 top-4 z-30 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm shadow-glow-blue">
          <Horong state="receive" size={28} />{toast.text}
        </Link>
      )}
    </Ctx.Provider>
  );
}
