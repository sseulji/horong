import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { checkIn } from "@/lib/actions";
import { Horong } from "@/components/Horong";
import { BackLink, btnPrimary } from "@/components/ui";

export const metadata = { title: "다시 펼치기" };

export default async function ResumePage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const { supabase, user } = await requireUser();
  const [{ data: book }, { data: ub }] = await Promise.all([
    supabase.from("books").select("id, title").eq("id", bookId).maybeSingle(),
    supabase.from("user_books").select("current_scene").eq("user_id", user.id).eq("book_id", bookId).maybeSingle(),
  ]);
  if (!book) notFound();
  const scene = ub?.current_scene ?? 1;
  const [{ data: sceneRow }, { data: myNote }, { data: notis }] = await Promise.all([
    supabase.from("scenes").select("title").eq("book_id", bookId).eq("idx", scene).maybeSingle(),
    supabase.from("notes").select("body, scene_idx").eq("user_id", user.id).eq("book_id", bookId).lte("scene_idx", scene).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("notifications").select("id, kind, scene_idx, ref_id, actor_id").eq("user_id", user.id).eq("book_id", bookId).is("read_at", null).order("created_at", { ascending: false }).limit(5),
  ]);
  const qIds = (notis ?? []).filter((n) => n.kind === "question" && n.ref_id).map((n) => n.ref_id!);
  const { data: qs } = qIds.length ? await supabase.from("questions").select("id, body, scene_idx").in("id", qIds) : { data: [] };
  const commentCount = (notis ?? []).filter((n) => n.kind === "comment").length;
  const hasNews = (notis?.length ?? 0) > 0;

  return (
    <main className="flex min-h-dvh flex-col gap-5 bg-[radial-gradient(110%_50%_at_50%_18%,#2A2560_0%,#151326_60%)] px-5 pb-8 pt-4">
      <BackLink href="/home" label="홈으로" />
      <div className="flex flex-col items-center gap-3.5 text-center">
        <Horong state={hasNews ? "receive" : "idle"} size={120} />
        <h1 className="font-serif text-[23px] font-normal leading-relaxed">
          {hasNews ? <>지난번에 머물렀던 장면에<br />새로운 이야기가 도착했어요</> : <>마지막으로 머문 장면이<br />그대로 기다리고 있어요</>}
        </h1>
      </div>

      <section className="glass flex flex-col gap-2 rounded-[20px] px-4 py-4">
        <span className="text-xs tracking-[0.14em] text-lavender">{book.title} · 장면 {String(scene).padStart(2, "0")} {sceneRow?.title ?? ""}</span>
        {myNote?.body && <p className="text-sm leading-relaxed text-ink-2">그때 남긴 내 감상 · <span className="text-ivory">“{myNote.body}”</span></p>}
      </section>

      <section aria-label="새로 도착한 이야기" className="flex flex-col gap-2.5">
        {(qs ?? []).map((q) => (
          <Link key={q.id} href={`/books/${bookId}/scenes/${q.scene_idx}`} className="flex flex-col gap-1.5 rounded-[20px] border border-blue/35 bg-blue/[0.08] px-4 py-4">
            <span className="text-xs text-blue">새 질문 · 장면 {q.scene_idx}</span>
            <span className="font-serif text-base leading-relaxed">“{q.body}”</span>
          </Link>
        ))}
        {commentCount > 0 && (
          <Link href={`/books/${bookId}/scenes/${myNote?.scene_idx ?? scene}`} className="flex flex-col gap-1.5 rounded-[20px] border border-pink/35 bg-pink/[0.08] px-4 py-4">
            <span className="text-xs text-pink">내 감상에 답글 {commentCount}개</span>
            <span className="text-sm">누군가 당신의 문장에 답했어요</span>
          </Link>
        )}
      </section>

      <form action={checkIn.bind(null, bookId)} className="mt-auto">
        <button className={`${btnPrimary} w-full`}>책을 다시 펼쳤어요</button>
      </form>
      <Link href="/home" className="flex h-12 items-center justify-center text-sm text-ink-2">다음에 볼게요</Link>
    </main>
  );
}
