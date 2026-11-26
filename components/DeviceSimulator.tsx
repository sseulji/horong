"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Horong } from "@/components/Horong";
import { BackLink } from "@/components/ui";
import { useDevice } from "@/components/AppShell";
import { saveDevice } from "@/lib/actions";
import { HORONG_LABEL, HORONG_STATES, type HorongState } from "@/lib/constants";

const EVENTS = [
  { type: "question_arrived", label: "Question Arrived", desc: "질문 도착 — 작은 빛 변화", tone: "#86B9FF" },
  { type: "opinion_arrived", label: "Opinion Arrived", desc: "의견 도착 — 은은한 밝기 변화", tone: "#E0B8F2" },
  { type: "connected_reader", label: "Connected Reader", desc: "같은 장면의 독자와 연결 — 두 빛이 만나요", tone: "#A9A3EF" },
] as const;

export function DeviceSimulator() {
  const { device, status } = useDevice();
  const [message, setMessage] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [, start] = useTransition();
  const brightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = (event: string, payload: Record<string, unknown> = {}) => {
    const s = device.getDeviceStatus();
    start(() => saveDevice({ connected: s.connected, brightness: s.brightness, focusMode: s.focusMode, lightState: s.lightState }, event, payload));
    setLog((l) => [`${new Date().toLocaleTimeString("ko-KR")} · ${event}`, ...l].slice(0, 6));
  };
  useEffect(() => () => { if (brightTimer.current) clearTimeout(brightTimer.current); }, []);

  const on = status.connected;
  const lvl = on ? status.brightness / 100 : 0;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-5 pb-8 pt-3">
      <header className="flex items-center gap-2">
        <BackLink href="/settings" label="설정으로" />
        <h1 className="flex-1 text-base font-medium">호롱 독서등</h1>
        <span className="rounded-full border border-blue/40 px-2.5 py-1 text-[11px] text-blue">Device Simulator</span>
      </header>
      <p className="text-xs leading-relaxed text-ink-3">실물 독서등은 아직 연결하지 않아요. 가상 기기가 같은 상태 변화를 보여주고, 상태는 내 계정에 저장돼요. 독서등이 없어도 앱의 모든 기능을 쓸 수 있어요.</p>

      <div className="glass flex items-center gap-3 rounded-[18px] px-3.5 py-3" style={{ borderColor: on ? "rgba(134,185,255,0.4)" : undefined }}>
        <span className="size-2.5 rounded-full" style={{ background: on ? "#86B9FF" : "#5A5585" }} />
        <div className="flex flex-1 flex-col">
          <span className="text-sm">{on ? "가상 독서등 연결됨" : "연결 해제됨"}</span>
          <span className="text-xs text-ink-3">{on ? `배터리 ${status.battery}% · 펌웨어 ${status.firmware}` : "연결하면 빛으로 소식을 알려줘요"}</span>
        </div>
        <button type="button" onClick={async () => { if (on) await device.disconnect(); else await device.connect(); setMessage(on ? "" : "독서등과 연결했어요"); persist(on ? "disconnect" : "connect"); }}
          className={`min-h-10 rounded-full border border-lavender/40 px-3.5 text-[13px] font-medium ${on ? "" : "bg-flame text-white"}`}>{on ? "연결 해제" : "연결하기"}</button>
      </div>

      <div role="img" aria-label={`조명 미리보기: ${HORONG_LABEL[status.lightState]}, 밝기 ${on ? status.brightness : 0}%`}
        className="relative flex h-[220px] flex-col items-center overflow-hidden rounded-3xl bg-night-deep">
        <div className="mt-3.5" style={{ opacity: on ? 1 : 0.5 }}><Horong state={on ? status.lightState : "sleep"} size={84} /></div>
        <div className="-mt-1.5 h-0 w-0" style={{ borderLeft: "90px solid transparent", borderRight: "90px solid transparent", borderBottom: `90px solid rgba(251,233,221,${(0.05 + lvl * 0.35).toFixed(2)})` }} />
        <div className="absolute inset-x-8 bottom-0 h-3.5 rounded-t" style={{ background: `rgba(243,232,229,${(0.08 + lvl * 0.6).toFixed(2)})` }} />
      </div>
      <p aria-live="polite" className="min-h-5 text-center text-[13px] text-pink">{message || HORONG_LABEL[on ? status.lightState : "sleep"]}</p>

      <fieldset disabled={!on} className="flex flex-col gap-4 disabled:opacity-40">
        <label className="flex flex-col gap-2 text-sm">밝기 · {status.brightness}%
          <input type="range" min={0} max={100} value={status.brightness} className="h-7 w-full accent-lavender"
            onChange={async (e) => {
              await device.setBrightness(Number(e.target.value));
              if (brightTimer.current) clearTimeout(brightTimer.current);
              brightTimer.current = setTimeout(() => persist("brightness", { value: Number(e.target.value) }), 400);
            }} />
        </label>
        <button type="button" role="switch" aria-checked={status.focusMode}
          onClick={async () => { await device.setFocusMode(!status.focusMode); setMessage(""); persist("focus", { on: !status.focusMode }); }}
          className={`flex h-[52px] items-center justify-between rounded-2xl border border-lavender/30 px-4 text-sm ${status.focusMode ? "bg-track" : ""}`}>
          Focus Mode — 조명 유지, 알림 반응 억제<strong>{status.focusMode ? "ON" : "OFF"}</strong>
        </button>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] text-ink-2">이벤트 보내기</span>
          <div className="grid grid-cols-3 gap-2">
            {EVENTS.map((ev) => (
              <button key={ev.type} type="button" className="min-h-[52px] rounded-[14px] border px-1.5 text-xs leading-snug" style={{ borderColor: ev.tone }}
                onClick={() => { const lit = device.signal(ev.type); setMessage(lit ? ev.desc : "집중 모드라 빛 반응을 미뤘어요 · 앱에 쌓아 둘게요"); persist(ev.type, { lit }); }}>
                {ev.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] text-ink-2">Character Light State</span>
          <div className="grid grid-cols-3 gap-1.5">
            {HORONG_STATES.map((s: HorongState) => (
              <button key={s} type="button" aria-pressed={status.lightState === s}
                onClick={async () => { await device.setLightState(s); setMessage(""); persist("light_state", { value: s }); }}
                className="h-10 rounded-xl border text-xs capitalize"
                style={{ borderColor: status.lightState === s ? "#A9A3EF" : "rgba(169,163,239,0.25)", background: status.lightState === s ? "rgba(104,100,199,0.4)" : "transparent" }}>{s}</button>
            ))}
          </div>
        </div>
      </fieldset>

      {!!log.length && (
        <section aria-label="최근 이벤트" className="rounded-2xl bg-surface-1 px-4 py-3 font-mono text-[11px] leading-6 text-ink-3">
          {log.map((l, i) => <p key={i}>{l}</p>)}
        </section>
      )}
    </main>
  );
}
