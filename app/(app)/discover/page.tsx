import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { addBook } from "@/lib/actions";
import { searchOpenLibrary } from "@/lib/books";
import { BookCover, SectionTitle } from "@/components/ui";

export const metadata = { title: "발견" };

type DbBook = { id: string; title: string; author: string; published_year: number | null; cover_url: string | null; isbn13: string | null };

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ q?: string; error?: string }> }) {
  const { q = "", error } = await searchParams;
  const { supabase, user } = await requireUser();
  const term = q.trim();

  const dbQuery = supabase.from("books").select("id, title, author, published_year, cover_url, isbn13").limit(10);
  const { data: dbBooks } = term
    ? /^[0-9-]{10,17}$/.test(term)
      ? await dbQuery.eq("isbn13", term.replace(/-/g, ""))
      : await dbQuery.or(`title.ilike.%${term.replace(/[%,()]/g, "")}%,author.ilike.%${term.replace(/[%,()]/g, "")}%`)
    : await dbQuery.eq("source", "seed");
  const external = term ? await searchOpenLibrary(term) : [];
  const { data: mine } = await supabase.from("user_books").select("book_id, current_scene, books(title)").eq("user_id", user.id).neq("status", "done");
  const owned = new Set((mine ?? []).map((m) => m.book_id));

  return (
    <main className="flex flex-col gap-6 px-5 pb-8 pt-5">
      <h1 className="font-serif text-3xl font-bold">발견</h1>
      {error && <p role="alert" className="rounded-2xl border border-danger/50 px-4 py-3 text-sm text-danger">책을 추가하지 못했어요. 다시 시도해 주세요.</p>}

      <form role="search" className="glass flex h-12 items-center gap-2.5 rounded-2xl px-4">
        <label htmlFor="dq" className="sr-only-input">도서 검색</label>
        <input id="dq" name="q" defaultValue={q} placeholder="제목, 저자, ISBN" className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#8F8AB8]" />
        <button className="min-h-10 rounded-full bg-flame px-4 text-sm font-semibold text-white">검색</button>
      </form>

      {!!mine?.length && !term && (
        <section aria-labelledby="h-scenes" className="flex flex-col gap-3">
          <SectionTitle id="h-scenes">읽고 있는 책의 장면별 감상</SectionTitle>
          {mine.map((m) => (
            <Link key={m.book_id} href={`/books/${m.book_id}/scenes/${m.current_scene ?? 1}`} className="flex items-center justify-between rounded-[18px] border line px-4 py-3.5 text-sm">
              <span className="font-serif text-base">{(m.books as unknown as { title: string }).title}</span>
              <span className="text-xs text-blue">장면 {m.current_scene ?? 1}의 마음 보기 ›</span>
            </Link>
          ))}
        </section>
      )}

      <section aria-labelledby="h-db" className="flex flex-col gap-3">
        <SectionTitle id="h-db">{term ? "호롱에 있는 책" : "함께 읽기 좋은 퍼블릭 도메인 단편"}</SectionTitle>
        {(dbBooks as DbBook[] | null)?.map((b) => (
          <div key={b.id} className="flex items-center gap-3.5 rounded-[18px] border line p-3">
            <BookCover title={b.title} url={b.cover_url} className="w-12 h-16" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-serif text-base">{b.title}</span>
              <span className="text-xs text-ink-3">{b.author}{b.published_year ? ` · ${b.published_year}` : ""}</span>
            </div>
            {owned.has(b.id) ? (
              <Link href={`/read/${b.id}`} className="text-xs text-blue">읽는 중 ›</Link>
            ) : (
              <form action={addBook}><input type="hidden" name="bookId" value={b.id} /><button className="min-h-10 rounded-full border border-lavender/35 px-3.5 text-[13px]">서재에 담기</button></form>
            )}
          </div>
        ))}
        {term && !dbBooks?.length && <p className="text-sm text-ink-3">호롱에 아직 없는 책이에요.</p>}
      </section>

      {term && (
        <section aria-labelledby="h-ol" className="flex flex-col gap-3">
          <SectionTitle id="h-ol">Open Library 검색 결과</SectionTitle>
          {external.map((b) => (
            <form key={b.externalId} action={addBook} className="flex items-center gap-3.5 rounded-[18px] border line p-3">
              <BookCover title={b.title} url={b.coverUrl} className="w-12 h-16" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-serif text-base">{b.title}</span>
                <span className="truncate text-xs text-ink-3">{b.author}{b.year ? ` · ${b.year}` : ""}{b.isbn13 ? ` · ISBN ${b.isbn13}` : ""}</span>
              </div>
              {(["title", "author", "externalId", "isbn13", "coverUrl"] as const).map((k) => <input key={k} type="hidden" name={k} value={b[k] ?? ""} />)}
              <input type="hidden" name="year" value={b.year ?? ""} />
              <button className="min-h-10 shrink-0 rounded-full border border-lavender/35 px-3.5 text-[13px]">담기</button>
            </form>
          ))}
          {!external.length && <p className="text-sm text-ink-3">검색 결과가 없거나 외부 검색에 연결할 수 없어요.</p>}
          <p className="text-xs text-ink-3">도서 정보 출처: Open Library (openlibrary.org)</p>
        </section>
      )}
    </main>
  );
}
