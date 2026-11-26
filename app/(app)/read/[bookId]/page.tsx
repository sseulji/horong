import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { addBook } from "@/lib/actions";
import { ReadingPanel } from "@/components/ReadingPanel";
import { BackLink, btnPrimary } from "@/components/ui";

export const metadata = { title: "독서 모드" };

export default async function ReadPage({ params, searchParams }: { params: Promise<{ bookId: string }>; searchParams: Promise<{ session?: string }> }) {
  const { bookId } = await params;
  const { session } = await searchParams;
  const { supabase, user } = await requireUser();
  const [{ data: book }, { data: scenes }, { data: ub }] = await Promise.all([
    supabase.from("books").select("id, title, author, scene_count").eq("id", bookId).maybeSingle(),
    supabase.from("scenes").select("idx, title").eq("book_id", bookId).order("idx"),
    supabase.from("user_books").select("current_scene, status").eq("user_id", user.id).eq("book_id", bookId).maybeSingle(),
  ]);
  if (!book) notFound();

  if (!ub) {
    return (
      <main className="flex flex-col gap-6 px-5 pt-4">
        <BackLink href="/discover" label="발견으로" />
        <p className="font-serif text-2xl">『{book.title}』을 서재에 담고 읽기 시작할까요?</p>
        <form action={addBook}><input type="hidden" name="bookId" value={book.id} /><button className={btnPrimary}>서재에 담기</button></form>
      </main>
    );
  }

  const scene = ub.current_scene ?? 1;
  const { count } = await supabase.from("notes").select("id", { count: "exact", head: true }).eq("book_id", bookId).eq("scene_idx", scene).neq("user_id", user.id);

  return (
    <ReadingPanel
      book={{ id: book.id, title: book.title, author: book.author }}
      scenes={scenes ?? []}
      initialScene={scene}
      sceneNoteCount={count ?? 0}
      sessionId={session || null}
    />
  );
}
