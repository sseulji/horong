import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { ChatRoom } from "@/components/ChatRoom";

export const metadata = { title: "30분 대화" };

export default async function ChatPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const { supabase, user } = await requireUser();
  const { data: room } = await supabase.from("chat_rooms").select("id, book_id, scene_idx, requester, addressee, status, expires_at, books(title)").eq("id", roomId).maybeSingle();
  if (!room) notFound();
  const otherId = room.requester === user.id ? room.addressee : room.requester;
  const [{ data: other }, { data: scene }, { data: messages }] = await Promise.all([
    supabase.from("public_profiles").select("nickname").eq("id", otherId).maybeSingle(),
    supabase.from("scenes").select("title").eq("book_id", room.book_id).eq("idx", room.scene_idx).maybeSingle(),
    supabase.from("chat_messages").select("id, user_id, body, created_at").eq("room_id", roomId).order("created_at"),
  ]);
  return (
    <ChatRoom
      room={{ id: room.id, bookId: room.book_id, sceneIdx: room.scene_idx, status: room.status, expiresAt: room.expires_at, bookTitle: (room.books as unknown as { title: string } | null)?.title ?? "", sceneTitle: scene?.title ?? `장면 ${room.scene_idx}` }}
      me={user.id}
      otherId={otherId}
      otherName={other?.nickname ?? "독자"}
      initial={messages ?? []}
    />
  );
}
