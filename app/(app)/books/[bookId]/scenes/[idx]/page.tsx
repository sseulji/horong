import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { Horong } from "@/components/Horong";
import { NoteCard, type NoteView } from "@/components/NoteCard";
import { BackLink, SectionTitle } from "@/components/ui";
import { EMOTIONS, QTYPE_LABEL } from "@/lib/constants";

export const metadata = { title: "같은 장면의 감상" };

export default async function ScenePage({ params, searchParams }: { params: Promise<{ bookId: string; idx: string }>; searchParams: Promise<{ e?: string; reveal?: string }> }) {
  const { bookId, idx } = await params;
  const { e: emotion, reveal } = await searchParams;
  const sceneIdx = Number(idx);
  const { supabase, user } = await requireUser();
  if (!Number.isInteger(sceneIdx) || sceneIdx < 1) notFound();

  const [{ data: book }, { data: scenes }, { data: ub }, { data: notes }, { data: questions }] = await Promise.all([
    supabase.from("books").select("id, title, scene_count").eq("id", bookId).maybeSingle(),
    supabase.from("scenes").select("idx, title").eq("book_id", bookId).order("idx"),
    supabase.from("user_books").select("current_scene, status").eq("user_id", user.id).eq("book_id", bookId).maybeSingle(),
    supabase.rpc("discover_notes", { p_book: bookId, p_scene: sceneIdx, p_reveal: reveal === "1" }),
    supabase.from("questions").select("id, body, source, qtype, user_id").eq("book_id", bookId).eq("scene_idx", sceneIdx).order("created_at", { ascending: false }).limit(10),
  ]);
  if (!book) notFound();

  const myScene = ub?.status === "done" ? Infinity : ub?.current_scene ?? 1;
  const isSpoilerScene = sceneIdx > myScene;
  const all = (notes ?? []) as NoteView[];
  const filtered = all.filter((n) => !emotion || n.emotions.includes(emotion));

  // 답글 (RLS가 차단 관계를 걸러줌)
  const ids = filtered.filter((n) => !n.is_spoiler).map((n) => n.id);
  const { data: comments } = ids.length
    ? await supabase.from("comments").select("id, note_id, user_id, body, created_at").in("note_id", ids).order("created_at")
    : { data: [] };
  const userIds = [...new Set((comments ?? []).map((c) => c.user_id))];
  const { data: names } = userIds.length ? await supabase.from("public_profiles").select("id, nickname").in("id", userIds) : { data: [] };
  const nick = new Map((names ?? []).map((n) => [n.id, n.nickname]));
  const commentsBy = new Map<string, { id: string; body: string; nickname: string; mine: boolean }[]>();
  (comments ?? []).forEach((c) => {
    const list = commentsBy.get(c.note_id) ?? [];
    list.push({ id: c.id, body: c.body, nickname: nick.get(c.user_id) ?? "독자", mine: c.user_id === user.id });
    commentsBy.set(c.note_id, list);
  });

  const sceneTitle = scenes?.find((s) => s.idx === sceneIdx)?.title ?? `장면 ${sceneIdx}`;
  const path = `/books/${bookId}/scenes/${sceneIdx}`;
  const q = (k: string, v?: string) => {
    const p = new URLSearchParams();
    if (k !== "e" && emotion) p.set("e", emotion);
    if (k !== "reveal" && reveal) p.set("reveal", reveal);
    if (v) p.set(k, v);
    const s = p.toString();
    return s ? `${path}?${s}` : path;
  };

  return (
    <main className="flex flex-col gap-4 px-5 pb-8 pt-4">
      <header className="flex items-center gap-3">
        <BackLink href={`/read/${bookId}`} label="독서 모드로" />
        <Horong state={all.length ? "connect" : "idle"} size={52} />
        <div className="flex flex-col">
          <p className="text-xs tracking-[0.14em] text-lavender">{book.title} · 장면 {String(sceneIdx).padStart(2, "0")}</p>
          <h1 className="font-serif text-[22px] leading-snug">{sceneTitle}에 머문 마음</h1>
        </div>
      </header>

      <nav aria-label="장면 이동" className="flex items-center justify-between text-sm">
        {sceneIdx > 1 ? <Link href={`/books/${bookId}/scenes/${sceneIdx - 1}`} className="min-h-10 content-center text-ink-2">‹ 이전 장면</Link> : <span />}
        <Link href={`${path}/questions`} className="min-h-10 content-center text-blue">이 장면의 질문 만들기</Link>
        {sceneIdx < (scenes?.length ?? book.scene_count) ? <Link href={`/books/${bookId}/scenes/${sceneIdx + 1}`} className="min-h-10 content-center text-ink-2">다음 장면 ›</Link> : <span />}
      </nav>

      <p className="rounded-xl bg-surface-1 px-3.5 py-2.5 text-xs leading-relaxed text-ink-2">
        {Number.isFinite(myScene) ? `내 진도(장면 ${myScene}) 이후의 감상은 가려져요. ` : "완독한 책이라 모든 장면을 볼 수 있어요. "}공개 범위 안의 기록만 보여요.
      </p>

      <div role="group" aria-label="감정으로 거르기" className="flex gap-2 overflow-x-auto pb-1">
        <Link href={q("e")} aria-current={!emotion ? "true" : undefined} className={`flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] ${!emotion ? "border-lavender bg-lavender text-night" : "border-lavender/35"}`}>전체</Link>
        {EMOTIONS.map((e) => (
          <Link key={e.id} href={q("e", e.id)} aria-current={emotion === e.id ? "true" : undefined}
            className={`flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] ${emotion === e.id ? "border-lavender bg-lavender text-night" : "border-lavender/35"}`}>{e.label}</Link>
        ))}
      </div>

      {isSpoilerScene && reveal !== "1" && filtered.some((n) => n.is_spoiler) && (
        <div className="flex flex-col items-center gap-2 rounded-[20px] border line px-4 py-5 text-center">
          <p className="text-sm">아직 읽지 않은 장면이에요. 감상 본문을 가려 두었어요.</p>
          <Link href={q("reveal", "1")} className="min-h-10 content-center text-[13px] text-pink">스포일러를 감수하고 보기</Link>
        </div>
      )}

      {filtered.map((n) => (
        <NoteCard key={n.id} note={n} comments={commentsBy.get(n.id) ?? []} path={path} bookId={bookId} sceneIdx={sceneIdx} />
      ))}

      {!filtered.length && (
        <div className="flex flex-col items-center gap-3 px-4 py-7 text-center">
          <Horong state="idle" size={72} />
          <p className="font-serif text-[17px]">아직 이 장면에 남겨진 다른 마음은 없어요.</p>
          <div className="flex gap-4 text-sm">
            <Link href={`${path}/questions`} className="text-pink underline">먼저 질문 남기기</Link>
            <Link href={`/read/${bookId}/record?scene=${sceneIdx}`} className="text-pink underline">내 감상 남기기</Link>
          </div>
        </div>
      )}

      {!!questions?.length && !isSpoilerScene && (
        <section aria-labelledby="h-q" className="mt-2 flex flex-col gap-2.5">
          <SectionTitle id="h-q">이 장면의 질문</SectionTitle>
          {questions.map((qq) => (
            <div key={qq.id} className="flex flex-col gap-1.5 rounded-[18px] border border-blue/30 bg-blue/[0.06] px-4 py-3.5">
              <span className="text-xs text-blue">{qq.source === "ai" ? "AI 발제문" : "독자 질문"} · {QTYPE_LABEL[qq.qtype]}</span>
              <p className="font-serif text-base leading-relaxed">{qq.body}</p>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
