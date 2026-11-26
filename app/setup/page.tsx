import { Horong } from "@/components/Horong";

export const metadata = { title: "설정 필요" };

export default function SetupPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-7 py-10">
      <Horong state="sleep" size={96} />
      <h1 className="font-serif text-3xl">Supabase 연결이 필요해요</h1>
      <ol className="list-decimal space-y-3 pl-5 text-[15px] leading-7 text-ink-2">
        <li>Supabase 프로젝트를 만들고 SQL Editor에서 <code className="text-pink">supabase/migrations/0001_schema.sql</code>, <code className="text-pink">0002_seed.sql</code>을 순서대로 실행합니다.</li>
        <li><code className="text-pink">.env.example</code>을 <code className="text-pink">.env.local</code>로 복사하고 URL과 anon key를 넣습니다.</li>
        <li>개발 서버를 다시 시작합니다: <code className="text-pink">npm run dev</code></li>
      </ol>
      <p className="text-sm text-ink-3">AI 키가 없어도 발제문은 샘플 질문으로 동작하고, 독서등은 시뮬레이터로 동작합니다.</p>
    </main>
  );
}
