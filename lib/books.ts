import "server-only";

/**
 * 도서 검색 서비스 계층
 *  1순위: 카카오(Daum) 책 검색 — 국내 도서, 표지·ISBN 제공 (KAKAO_REST_API_KEY, 서버 전용)
 *  대체:  Open Library — 키 불필요 (카카오 키가 없거나 호출 실패 시)
 * 어떤 소스도 도서 본문은 제공하지 않으며, 서지 정보만 사용한다.
 */
export type BookSource = "kakao" | "openlibrary";

export interface BookHit {
  title: string;
  author: string;
  publisher?: string | null;
  year?: number | null;
  isbn13?: string | null;
  coverUrl?: string | null;
  externalId: string;
  source: BookSource;
}

export interface BookSearchResult {
  hits: BookHit[];
  provider: BookSource;
  attribution: string;
}

const isIsbnQuery = (q: string) => /^[0-9-]{10,17}$/.test(q.trim());

// ------------------------------------------------------------------ kakao
type KakaoDoc = {
  title: string; contents: string; url: string; isbn: string; datetime: string;
  authors: string[]; publisher: string; translators: string[]; thumbnail: string;
};

export async function searchKakao(q: string, key: string): Promise<BookHit[]> {
  const params = new URLSearchParams({ query: isIsbnQuery(q) ? q.replace(/-/g, "") : q, size: "10" });
  if (isIsbnQuery(q)) params.set("target", "isbn");
  const res = await fetch(`https://dapi.kakao.com/v3/search/book?${params}`, {
    headers: { Authorization: `KakaoAK ${key}` },
    signal: AbortSignal.timeout(6000),
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`kakao ${res.status}`);
  const data = (await res.json()) as { documents: KakaoDoc[] };
  return data.documents.map((d) => {
    const isbn13 = d.isbn.split(/\s+/).find((i) => /^[0-9]{13}$/.test(i)) ?? null;
    const year = d.datetime ? Number(d.datetime.slice(0, 4)) || null : null;
    return {
      title: d.title,
      author: d.authors.length ? d.authors.join(", ") : "작자 미상",
      publisher: d.publisher || null,
      year,
      isbn13,
      coverUrl: d.thumbnail || null,
      externalId: isbn13 ?? d.url,
      source: "kakao" as const,
    };
  });
}

// ------------------------------------------------------------ openlibrary
type OLDoc = { key: string; title: string; author_name?: string[]; first_publish_year?: number; isbn?: string[]; cover_i?: number };

export async function searchOpenLibrary(q: string): Promise<BookHit[]> {
  const param = isIsbnQuery(q) ? `isbn=${encodeURIComponent(q.replace(/-/g, ""))}` : `q=${encodeURIComponent(q)}`;
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

// ---------------------------------------------------------------- service
export async function searchBooks(q: string): Promise<BookSearchResult> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (key) {
    try {
      return { hits: await searchKakao(q, key), provider: "kakao", attribution: "도서 정보 제공: Daum 책 검색 (Kakao)" };
    } catch {
      // 쿼터 초과·장애 시 Open Library로 대체
    }
  }
  return { hits: await searchOpenLibrary(q), provider: "openlibrary", attribution: "도서 정보 제공: Open Library (openlibrary.org)" };
}
