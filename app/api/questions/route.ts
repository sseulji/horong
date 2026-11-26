import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateQuestions } from "@/lib/ai/questions";

const Body = z.object({
  bookId: z.string().uuid(),
  sceneIdx: z.number().int().min(1),
  variant: z.number().int().min(0).max(20).default(0),
  types: z.array(z.enum(["emotion", "interpretation", "perspective"])).max(3).optional(),
});

/** AI 발제문 생성 API — 서비스 계층(lib/ai/questions)만 호출한다. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { bookId, sceneIdx, variant, types } = parsed.data;

  const [{ data: book }, { data: scenes }, { data: ub }, { data: myNote }] = await Promise.all([
    supabase.from("books").select("title, author, published_year").eq("id", bookId).maybeSingle(),
    supabase.from("scenes").select("idx, title").eq("book_id", bookId).order("idx"),
    supabase.from("user_books").select("current_scene, status").eq("user_id", auth.user.id).eq("book_id", bookId).maybeSingle(),
    supabase.from("notes").select("body, passages(quote, description)").eq("user_id", auth.user.id).eq("book_id", bookId).eq("scene_idx", sceneIdx)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!book) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 스포일러 허용 범위: 내가 읽은 장면까지 (완독이면 전체)
  const limit = ub?.status === "done" ? Infinity : Math.max(ub?.current_scene ?? 1, 1);
  if (sceneIdx > limit) return NextResponse.json({ error: "아직 읽지 않은 장면이에요" }, { status: 403 });
  const read = (scenes ?? []).filter((s) => s.idx <= limit);
  const passage = (myNote?.passages as unknown as { quote: string | null; description: string | null } | null) ?? null;

  const result = await generateQuestions(
    {
      book: { title: book.title, author: book.author, year: book.published_year },
      sceneIdx,
      sceneTitle: read.find((s) => s.idx === sceneIdx)?.title ?? `장면 ${sceneIdx}`,
      readSceneTitles: read.map((s) => `${s.idx}. ${s.title}`),
      passage: passage?.quote ?? passage?.description ?? null,
      note: myNote?.body ?? null,
      types,
    },
    variant,
  );
  return NextResponse.json(result);
}
