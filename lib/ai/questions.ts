/**
 * AI 발제문 서비스 계층 (PRD F04)
 * - Provider 인터페이스로 분리: 실제 LLM(Anthropic) ↔ 샘플 템플릿을 교체 가능.
 * - AI는 정답을 주지 않고 대화의 계기만 제안한다. 최대 3개.
 * - 도서 전문을 가정하지 않는다: 메타데이터 + 사용자가 직접 입력한 구절·감상 + 진도까지의 장면 라벨만 입력.
 * - 실패하거나 키가 없으면 기본 질문 템플릿으로 대체한다.
 */
export type QuestionType = "emotion" | "interpretation" | "perspective";

export interface QuestionInput {
  book: { title: string; author: string; year?: number | null };
  sceneIdx: number;
  sceneTitle: string;
  /** 사용자가 읽은 장면까지의 라벨만 (스포일러 허용 범위) */
  readSceneTitles: string[];
  passage?: string | null;
  note?: string | null;
  types?: QuestionType[];
}

export interface GeneratedQuestion {
  type: QuestionType;
  text: string;
}

export interface QuestionResult {
  questions: GeneratedQuestion[];
  provider: "anthropic" | "sample";
  fallbackReason?: string;
}

export interface QuestionProvider {
  name: QuestionResult["provider"];
  generate(input: QuestionInput): Promise<GeneratedQuestion[]>;
}

// ------------------------------------------------------------------ sample
const TEMPLATES: Record<QuestionType, ((i: QuestionInput) => string)[]> = {
  emotion: [
    (i) => `‘${i.sceneTitle}’ 장면에서 어떤 감정을 느꼈나요?`,
    (i) => `이 장면을 읽고 가장 오래 남은 마음은 무엇이었나요?`,
  ],
  interpretation: [
    (i) => `이 장면에서 인물의 선택을 어떻게 생각하나요?`,
    (i) => `『${i.book.title}』의 제목은 지금까지 어떤 뜻으로 읽히나요?`,
  ],
  perspective: [
    () => `다른 상황이었다면 나는 어떻게 행동했을까요?`,
    () => `이 장면을 다른 인물의 눈으로 다시 본다면 어떻게 보일까요?`,
  ],
};

export class SampleQuestionProvider implements QuestionProvider {
  name = "sample" as const;
  constructor(private variant = 0) {}
  async generate(input: QuestionInput) {
    const types = input.types?.length ? input.types : (["emotion", "interpretation", "perspective"] as QuestionType[]);
    return types.slice(0, 3).map((type) => {
      const list = TEMPLATES[type];
      return { type, text: list[this.variant % list.length](input) };
    });
  }
}

// --------------------------------------------------------------- anthropic
export class AnthropicQuestionProvider implements QuestionProvider {
  name = "anthropic" as const;
  constructor(private apiKey: string, private model = process.env.AI_MODEL || "claude-haiku-5-5") {}

  async generate(input: QuestionInput) {
    const system = [
      "너는 독서 서비스 '호롱'의 발제문 도우미다.",
      "책을 해석한 정답을 말하지 말고, 독자끼리 대화를 시작할 열린 질문만 만든다.",
      "사용자가 읽은 장면 목록 밖의 줄거리, 결말, 이후 사건은 절대 언급하거나 암시하지 않는다.",
      "모르는 내용은 지어내지 말고, 제공된 구절·감상·장면 라벨만 근거로 삼는다.",
      'JSON 배열만 출력한다: [{"type":"emotion|interpretation|perspective","text":"..."}] 최대 3개, 각 60자 이내 한국어.',
    ].join("\n");
    const user = JSON.stringify({
      book: input.book,
      current_scene: { idx: input.sceneIdx, title: input.sceneTitle },
      allowed_scenes: input.readSceneTitles,
      passage: input.passage ?? null,
      reader_note: input.note ?? null,
      requested_types: input.types ?? ["emotion", "interpretation", "perspective"],
    });
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: this.model, max_tokens: 600, system, messages: [{ role: "user", content: user }] }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((c) => c.type === "text")?.text ?? "";
    const json = text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
    const parsed = JSON.parse(json) as GeneratedQuestion[];
    return parsed
      .filter((q) => q && typeof q.text === "string" && ["emotion", "interpretation", "perspective"].includes(q.type))
      .slice(0, 3)
      .map((q) => ({ type: q.type, text: q.text.trim().slice(0, 120) }));
  }
}

// ------------------------------------------------------ spoiler guard
const SPOILER_WORDS = ["결말", "마지막에", "끝내", "죽", "결국", "나중에", "후반"];
export function looksLikeSpoiler(text: string) {
  return SPOILER_WORDS.some((w) => text.includes(w));
}

// ------------------------------------------------------------ service
export async function generateQuestions(input: QuestionInput, variant = 0): Promise<QuestionResult> {
  const sample = new SampleQuestionProvider(variant);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { questions: await sample.generate(input), provider: "sample", fallbackReason: "API 키 없음" };
  try {
    const qs = (await new AnthropicQuestionProvider(key).generate(input)).filter((q) => !looksLikeSpoiler(q.text));
    if (!qs.length) throw new Error("empty");
    return { questions: qs, provider: "anthropic" };
  } catch (e) {
    return { questions: await sample.generate(input), provider: "sample", fallbackReason: "생성 실패 — 기본 질문 사용" };
  }
}
