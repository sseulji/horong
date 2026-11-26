import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { removeBook, setStatus } from "@/lib/actions";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/constants";
import { BookCover, SceneProgress, btnSecondary } from "@/components/ui";

export const metadata = { title: "내 서재" };

const FILTERS = [["all", "전체"], ["reading", "읽는 중"], ["paused", "멈춤"], ["done", "완독"]] as const;
const NEXT: Record<string, "reading" | "paused" | "done"> = { reading: "paused", paused: "done", done: "reading" };

type Row = { book_id: string; status: string; current_scene: number | null; books: { title: string; author: string; published_year: number | null; cover_url: string | null; scene_count: number } };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ s?: string; q?: string; added?: string }> }) {
  const { s = "all", q = "", added } = await searchParams;
  const { supabase, user } = await requireUser();
  let query = supabase.from("user_books").select("book_id, status, current_scene, books(title, author, published_year, cover_url, scene_count)").eq("user_id", user.id).order("updated_at", { ascending: false });
  if (s !== "all") query = query.eq("status", s);
  const { data } = await query;
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => !q || `${r.books.title}${r.books.author}`.includes(q));

  return (
    <main className="flex flex-col gap-5 px-5 pb-8 pt-5">
      <header className="flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold">내 서재</h1>
        <Link href="/settings" aria-label="프로필과 설정" className="inline-flex size-11 items-center justify-center rounded-full border border-lavender/30">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>
        </Link>
      </header>
      {added && <p role="status" className="rounded-2xl bg-surface-1 px-4 py-3 text-sm text-pink">서재에 담았어요. 이미 있던 책은 그대로 두었어요.</p>}

      <form className="glass flex h-12 items-center gap-2.5 rounded-2xl px-4" role="search">
        <input type="hidden" name="s" value={s} />
        <label htmlFor="q" className="sr-only-input">서재에서 제목·저자 검색</label>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A9A3EF" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <input id="q" name="q" defaultValue={q} placeholder="제목, 저자로 찾기" className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#8F8AB8]" />
      </form>

      <nav aria-label="독서 상태" className="grid grid-cols-4 gap-1.5 rounded-full bg-surface-1 p-1">
        {FILTERS.map(([id, label]) => (
          <Link key={id} href={`/library?s=${id}${q ? `&q=${encodeURIComponent(q)}` : ""}`} aria-current={s === id ? "page" : undefined}
            className={`flex h-10 items-center justify-center rounded-full text-[13px] font-medium ${s === id ? "bg-flame text-white" : "text-ink-2"}`}>{label}</Link>
        ))}
      </nav>

      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.book_id} className="flex gap-3.5 rounded-[20px] border line bg-white/[0.04] p-3.5">
            <BookCover title={r.books.title} url={r.books.cover_url} className="w-14 h-20" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link href={`/read/${r.book_id}`} className="font-serif text-[17px] hover:underline">{r.books.title}</Link>
              <span className="text-xs text-ink-3">{r.books.author}{r.books.published_year ? ` · ${r.books.published_year}` : ""}</span>
              <SceneProgress total={r.books.scene_count} current={r.current_scene} />
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="rounded-full border px-2.5 py-0.5 text-xs" style={{ borderColor: STATUS_TONE[r.status], color: STATUS_TONE[r.status] }}>{STATUS_LABEL[r.status]}</span>
                <form action={setStatus.bind(null, r.book_id, NEXT[r.status])} className="ml-auto">
                  <button className="min-h-9 rounded-full border border-lavender/30 px-3 text-xs text-ink-2">{STATUS_LABEL[NEXT[r.status]]}(으)로</button>
                </form>
                <form action={removeBook.bind(null, r.book_id)}>
                  <button className="min-h-9 px-2 text-xs text-ink-3" aria-label={`${r.books.title} 서재에서 빼기`}>빼기</button>
                </form>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {!rows.length && <p className="p-6 text-center text-sm text-ink-3">조건에 맞는 책이 없어요. 발견 탭에서 새 책을 검색해 추가할 수 있어요.</p>}
      <Link href="/discover" className={`${btnSecondary} border-dashed text-pink`}>책 검색해서 서재에 추가</Link>
    </main>
  );
}
