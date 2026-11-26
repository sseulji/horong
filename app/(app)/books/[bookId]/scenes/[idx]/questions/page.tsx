import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { QuestionStudio } from "@/components/QuestionStudio";

export const metadata = { title: "AI 발제문" };

export default async function QuestionsPage({ params }: { params: Promise<{ bookId: string; idx: string }> }) {
  const { bookId, idx } = await params;
  const sceneIdx = Number(idx);
  const { supabase } = await requireUser();
  const [{ data: book }, { data: scene }] = await Promise.all([
    supabase.from("books").select("id, title").eq("id", bookId).maybeSingle(),
    supabase.from("scenes").select("title").eq("book_id", bookId).eq("idx", sceneIdx).maybeSingle(),
  ]);
  if (!book || !Number.isInteger(sceneIdx)) notFound();
  return <QuestionStudio bookId={book.id} sceneIdx={sceneIdx} sceneTitle={scene?.title ?? `장면 ${sceneIdx}`} />;
}
