/** 도서 검색: 내 DB(시드 포함) + Open Library 공개 API (키 불필요). */
export interface BookHit {
  id?: string;
  title: string;
  author: string;
  year?: number | null;
  isbn13?: string | null;
  coverUrl?: string | null;
  externalId?: string | null;
  source: "db" | "openlibrary";
}

type OLDoc = { key: string; title: string; author_name?: string[]; first_publish_year?: number; isbn?: string[]; cover_i?: number };

export async function searchOpenLibrary(q: string): Promise<BookHit[]> {
  const isIsbn = /^[0-9-]{10,17}$/.test(q.trim());
  const param = isIsbn ? `isbn=${encodeURIComponent(q.replace(/-/g, ""))}` : `q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(`https://openlibrary.org/search.json?${param}&limit=8&fields=key,title,author_name,first_publish_year,isbn,cover_i`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { docs: OLDoc[] };
    return data.docs.map((d) => ({
      title: d.title,
      author: d.author_name?.join(", ") ?? "작자 미상",
      year: d.first_publish_year ?? null,
      isbn13: d.isbn?.find((i) => /^[0-9]{13}$/.test(i)) ?? null,
      coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
      externalId: d.key,
      source: "openlibrary" as const,
    }));
  } catch {
    return [];
  }
}
