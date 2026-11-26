import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { Horong } from "@/components/Horong";
import { DevicePill } from "@/components/DevicePill";
import { BookCover, SceneProgress, SectionTitle, btnPrimary } from "@/components/ui";
import { markNotificationsRead } from "@/lib/actions";

export const metadata = { title: "홈" };

type Book = { id: string; title: string; author: string; cover_url: string | null; scene_count: number };

export default async function HomePage() {
  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: current }, { data: notis }, { data: friends }] = await Promise.all([
    supabase.from("profiles").select("nickname").eq("id", user.id).single(),
    supabase.from("user_books").select("book_id, current_scene, status, books(id, title, author, cover_url, scene_count)")
      .eq("user_id", user.id).neq("status", "done").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("notifications").select("id, kind, book_id, scene_idx, ref_id").eq("user_id", user.id).is("read_at", null).order("created_at", { ascending: false }).limit(20),
    supabase.rpc("friend_progress"),
  ]);

  const book = (current?.books ?? null) as unknown as Book | null;
  const scene = current?.current_scene ?? null;
  const sceneTitle = book && scene
    ? (await supabase.from("scenes").select("title").eq("book_id", book.id).eq("idx", scene).maybeSingle()).data?.title
    : null;
  // 내 진도 이하 장면에 다른 독자가 남긴 최신 질문
  const { data: question } = book
    ? await supabase.from("questions").select("id, body, scene_idx, source").eq("book_id", book.id).neq("user_id", user.id)
        .lte("scene_idx", scene ?? 1).order("created_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };

  const forBook = (notis ?? []).filter((n) => book && n.book_id === book.id);
  const hasArrivals = forBook.length > 0;
  const sameBookFriends = (friends ?? []).filter((f: { book_id: string | null }) => book && f.book_id === book.id);

  return (
    <main className="flex flex-col gap-6 px-5 pb-8 pt-5">
      <header className="flex items-center justify-between gap-3">
        <p className="text-[15px] text-ink-2">좋은 시간이에요, <strong className="font-semibold text-ivory">{profile?.nickname}</strong>님</p>
        <DevicePill />
      </header>

      {book ? (
        <Link href={hasArrivals ? `/resume/${book.id}` : `/read/${book.id}`}
          className="flex flex-col items-center gap-3.5 rounded-[28px] border line bg-[radial-gradient(90%_80%_at_50%_30%,rgba(104,100,199,0.35),rgba(29,26,54,0.9))] px-5 pb-6 pt-7 text-center">
          <Horong state={hasArrivals ? "receive" : "idle"} size={112} />
          <p className="font-serif text-[21px] leading-relaxed">
            {hasArrivals ? <>지난번 머물렀던 장면에<br />새로운 이야기가 도착했어요</> : <>천천히, 원하는 만큼만<br />읽어도 괜찮아요</>}
          </p>
          {hasArrivals && <span className="text-[13px] text-pink">새 소식 {forBook.length}개 보러 가기 ›</span>}
        </Link>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-[28px] border line bg-surface-1 px-5 py-8 text-center">
          <Horong state="idle" size={112} />
          <p className="font-serif text-xl">어떤 책과 함께할까요?</p>
          <Link href="/discover" className={btnPrimary}>책 찾아서 서재에 담기</Link>
        </div>
      )}

      {book && (
        <section aria-labelledby="h-reading" className="flex flex-col gap-3">
          <SectionTitle id="h-reading">읽고 있는 책</SectionTitle>
          <div className="glass flex gap-4 rounded-[20px] p-4">
            <BookCover title={book.title} url={book.cover_url} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p className="font-serif text-lg">{book.title}</p>
              <p className="text-xs text-ink-3">{book.author}{scene ? ` · 마지막 위치 장면 ${scene}${sceneTitle ? ` · ${sceneTitle}` : ""}` : " · 진도 입력 안 함"}</p>
              <div className="mt-auto"><SceneProgress total={book.scene_count} current={scene} /></div>
            </div>
          </div>
          <Link href={`/read/${book.id}`} className={btnPrimary}>이어서 읽기</Link>
        </section>
      )}

      <section aria-labelledby="h-conn" className="flex flex-col gap-3">
        <SectionTitle id="h-conn">새로운 연결</SectionTitle>
        {question && book && (
          <Link href={`/books/${book.id}/scenes/${question.scene_idx}`} className="flex flex-col gap-2 rounded-[20px] border border-blue/30 bg-blue/[0.08] px-4 py-4">
            <span className="text-xs text-blue">{question.source === "ai" ? "AI 발제문" : "새 질문"} · 장면 {question.scene_idx}</span>
            <span className="font-serif text-base leading-relaxed">“{question.body}”</span>
          </Link>
        )}
        {(notis?.length ?? 0) > 0 && (
          <form action={markNotificationsRead} className="flex items-center gap-3 rounded-[20px] border line px-4 py-3.5">
            <span className="flex-1 text-sm">읽지 않은 소식 {notis!.length}개</span>
            <button type="submit" className="min-h-10 text-xs text-ink-2 underline">모두 확인</button>
          </form>
        )}
        {sameBookFriends.map((f: { friend_id: string; nickname: string; current_scene: number | null }) => (
          <Link key={f.friend_id} href="/connect" className="flex items-center gap-3 rounded-[20px] border line px-4 py-3.5">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-track text-[13px]">{f.nickname[0]}</span>
            <span className="flex-1 text-sm">{f.nickname}님도 같은 책을 읽고 있어요</span>
            <span className="text-xs text-ink-2">함께 읽기 ›</span>
          </Link>
        ))}
        {!question && !(notis?.length) && !sameBookFriends.length && (
          <p className="rounded-[20px] border line px-4 py-4 text-sm text-ink-3">아직 도착한 이야기가 없어요. 인상 깊은 장면을 기록하면 같은 장면의 독자를 찾아볼게요.</p>
        )}
      </section>
    </main>
  );
}
