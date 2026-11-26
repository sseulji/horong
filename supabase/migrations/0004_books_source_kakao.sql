-- 카카오(Daum) 책 검색으로 추가한 도서 허용
alter table public.books drop constraint if exists books_source_check;
alter table public.books add constraint books_source_check check (source in ('seed', 'openlibrary', 'kakao', 'manual'));
