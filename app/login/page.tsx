import Link from "next/link";
import { signIn, signUp } from "@/lib/actions";
import { Horong } from "@/components/Horong";
import { btnPrimary } from "@/components/ui";

export const metadata = { title: "로그인" };

const field = "h-12 w-full rounded-2xl border border-lavender/30 bg-white/5 px-4 text-[15px] text-ivory placeholder:text-[#8F8AB8] outline-none focus:border-blue";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string; error?: string; notice?: string }> }) {
  const { mode, error, notice } = await searchParams;
  const signup = mode === "signup";
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-7 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <Horong state="idle" size={88} />
        <h1 className="font-serif text-3xl">{signup ? "호롱과 함께 읽기 시작" : "다시 만나서 반가워요"}</h1>
      </div>
      {error && <p role="alert" className="rounded-2xl border border-danger/50 px-4 py-3 text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="rounded-2xl border border-blue/40 px-4 py-3 text-sm text-[#C9DDFF]">{notice}</p>}
      <form action={signup ? signUp : signIn} className="flex flex-col gap-4">
        {signup && (
          <label className="flex flex-col gap-2 text-sm">닉네임
            <input name="nickname" required maxLength={24} className={field} placeholder="다른 독자에게 보일 이름" />
          </label>
        )}
        <label className="flex flex-col gap-2 text-sm">이메일
          <input name="email" type="email" required autoComplete="email" className={field} />
        </label>
        <label className="flex flex-col gap-2 text-sm">비밀번호
          <input name="password" type="password" required minLength={6} autoComplete={signup ? "new-password" : "current-password"} className={field} />
        </label>
        <button type="submit" className={`${btnPrimary} mt-2`}>{signup ? "가입하기" : "로그인"}</button>
      </form>
      <p className="text-center text-sm text-ink-2">
        {signup ? <>이미 계정이 있나요? <Link href="/login" className="text-pink underline">로그인</Link></> : <>처음이신가요? <Link href="/login?mode=signup" className="text-pink underline">가입하기</Link></>}
      </p>
      <p className="text-center text-xs leading-relaxed text-ink-3">위치·연락처는 수집하지 않아요. 독서 진도는 기본 비공개예요.</p>
    </main>
  );
}
