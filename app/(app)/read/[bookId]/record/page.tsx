import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { RecordFlow } from "@/components/RecordFlow";
import { SIM_PAGES } from "@/lib/sim-pages";

export const metadata = { title: "구절 · 감정 기록" };

export default async function RecordPage({ params, searchParams }: { params: Promise<{ bookId: string }>; searchParams: Promise<{ scene?: string }> }) {
  const { bookId } = await params;
  const { scene } = await searchParams;
  const { supabase, user } = await requireUser();
  const [{ data: book }, { data: scenes }, { data: profile }, { data: ub }] = await Promise.all([
    supabase.from("books").select("id, title").eq("id", bookId).maybeSingle(),
    supabase.from("scenes").select("idx, title").eq("book_id", bookId).order("idx"),
    supabase.from("profiles").select("default_visibility").eq("id", user.id).single(),
    supabase.from("user_books").select("current_scene").eq("user_id", user.id).eq("book_id", bookId).maybeSingle(),
  ]);
  if (!book) notFound();
  const sceneIdx = Math.max(1, Number(scene) || ub?.current_scene || 1);
  const sim = SIM_PAGES[bookId];

  return (
    <RecordFlow
      book={book}
      scenes={scenes ?? []}
      initialScene={sceneIdx}
      defaultVisibility={(profile?.default_visibility as "private" | "friends" | "public") ?? "public"}
      simPage={sim ?? null}
    />
  );
}
