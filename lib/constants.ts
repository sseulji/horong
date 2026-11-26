export const EMOTIONS = [
  { id: "overwhelmed", label: "벅차오름", tone: "#E0B8F2" },
  { id: "empathy", label: "공감", tone: "#A9A3EF" },
  { id: "sad", label: "슬픔", tone: "#86B9FF" },
  { id: "flutter", label: "설렘", tone: "#F3E8E5" },
  { id: "comfort", label: "위로", tone: "#A9A3EF" },
  { id: "surprise", label: "놀라움", tone: "#86B9FF" },
  { id: "anger", label: "분노", tone: "#FFA3B5" },
  { id: "curious", label: "궁금함", tone: "#F3E8E5" },
] as const;
export type EmotionId = (typeof EMOTIONS)[number]["id"];
export const emotionLabel = (id: string) => EMOTIONS.find((e) => e.id === id)?.label ?? id;
export const emotionTone = (id: string) => EMOTIONS.find((e) => e.id === id)?.tone ?? "#A9A3EF";

export const VISIBILITY = [
  { id: "private", label: "나만 보기" },
  { id: "friends", label: "친구에게" },
  { id: "public", label: "모든 독자" },
] as const;
export type Visibility = (typeof VISIBILITY)[number]["id"];

export const STATUS_LABEL: Record<string, string> = { reading: "읽는 중", paused: "잠시 멈춤", done: "완독" };
export const STATUS_TONE: Record<string, string> = { reading: "#86B9FF", paused: "#E0B8F2", done: "#A9A3EF" };

export const HORONG_STATES = ["idle", "remember", "connect", "receive", "focus", "sleep"] as const;
export type HorongState = (typeof HORONG_STATES)[number];
export const HORONG_LABEL: Record<HorongState, string> = {
  idle: "떠다니는 중",
  remember: "감상을 기억하는 중",
  connect: "다른 독자와 연결됨",
  receive: "질문·의견 도착",
  focus: "집중 모드",
  sleep: "독서 마무리",
};

export const QTYPE_LABEL: Record<string, string> = { emotion: "감정형", interpretation: "해석형", perspective: "관점형", other: "질문" };
