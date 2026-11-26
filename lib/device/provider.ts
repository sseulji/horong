/**
 * Device Layer (PRD §12)
 * 실제 독서등(BLE 등)이 생기면 DeviceProvider 구현만 교체한다.
 * MVP에서는 MockDeviceProvider가 같은 상태 변화를 시뮬레이션한다.
 */
import type { HorongState } from "@/lib/constants";

export interface DeviceStatus {
  connected: boolean;
  brightness: number;
  focusMode: boolean;
  lightState: HorongState;
  battery: number;
  firmware: string;
}

export type DeviceEvent =
  | { type: "connect" | "disconnect" }
  | { type: "brightness"; value: number }
  | { type: "focus"; value: boolean }
  | { type: "light_state"; value: HorongState }
  | { type: "question_arrived" | "opinion_arrived" | "connected_reader" };

export interface DeviceProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setBrightness(value: number): Promise<void>;
  setFocusMode(on: boolean): Promise<void>;
  setLightState(state: HorongState): Promise<void>;
  getDeviceStatus(): DeviceStatus;
  /** 시뮬레이터 전용: 외부 이벤트 주입. 집중 모드면 빛 반응을 억제하고 false 반환 */
  signal(type: "question_arrived" | "opinion_arrived" | "connected_reader"): boolean;
  subscribe(fn: (s: DeviceStatus, e: DeviceEvent) => void): () => void;
}

const PULSE_MS = 3500;

export class MockDeviceProvider implements DeviceProvider {
  private status: DeviceStatus;
  private base: HorongState;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(s: DeviceStatus, e: DeviceEvent) => void>();

  constructor(initial?: Partial<DeviceStatus>) {
    this.status = { connected: false, brightness: 60, focusMode: false, lightState: "idle", battery: 82, firmware: "sim-0.1", ...initial };
    this.base = this.status.lightState;
  }
  private emit(e: DeviceEvent) {
    const snap = { ...this.status };
    this.listeners.forEach((fn) => fn(snap, e));
  }
  async connect() { this.status.connected = true; this.status.lightState = this.status.focusMode ? "focus" : this.base; this.emit({ type: "connect" }); }
  async disconnect() { this.status.connected = false; this.status.lightState = "sleep"; this.emit({ type: "disconnect" }); }
  async setBrightness(value: number) { this.status.brightness = Math.max(0, Math.min(100, Math.round(value))); this.emit({ type: "brightness", value: this.status.brightness }); }
  async setFocusMode(on: boolean) {
    this.status.focusMode = on;
    this.status.lightState = on ? "focus" : this.base === "focus" ? "idle" : this.base;
    if (!on && this.base === "focus") this.base = "idle";
    this.emit({ type: "focus", value: on });
  }
  async setLightState(state: HorongState) {
    this.base = state;
    if (state === "focus") return this.setFocusMode(true);
    this.status.focusMode = false;
    this.status.lightState = state;
    this.emit({ type: "light_state", value: state });
  }
  getDeviceStatus() { return { ...this.status }; }
  signal(type: "question_arrived" | "opinion_arrived" | "connected_reader") {
    if (!this.status.connected || this.status.focusMode) { this.emit({ type }); return false; }
    if (this.timer) clearTimeout(this.timer);
    this.status.lightState = type === "connected_reader" ? "connect" : "receive";
    this.emit({ type });
    this.timer = setTimeout(() => { this.status.lightState = this.base; this.emit({ type: "light_state", value: this.base }); }, PULSE_MS);
    return true;
  }
  subscribe(fn: (s: DeviceStatus, e: DeviceEvent) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
}
