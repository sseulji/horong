"use client";
import Link from "next/link";
import { useDevice } from "@/components/AppShell";

export function DevicePill() {
  const { status } = useDevice();
  return (
    <Link href="/device" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-blue/40 px-3.5 text-xs">
      <span className="size-2 rounded-full" style={{ background: status.connected ? "#86B9FF" : "#5A5585", boxShadow: status.connected ? "0 0 8px #86B9FF" : "none" }} />
      {status.connected ? (status.focusMode ? "독서등 · 집중 모드" : "독서등 연결됨") : "독서등 없이 사용 중"}
    </Link>
  );
}
