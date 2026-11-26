"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { EMOTIONS, HORONG_STATES } from "@/lib/constants";

const uuid = z.string().uuid();
const emotionIds = EMOTIONS.map((e) => e.id) as [string, ...string[]];

// ---------------------------------------------------------------- auth
export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const parsed = z.object({ email: z.string().email(), password: z.string().min(6) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/login?error=" + encodeURIComponent("이메일과 6자 이상 비밀번호를 확인해 주세요"));
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/login?error=" + encodeURIComponent("로그인에 실패했어요. 이메일·비밀번호를 확인해 주세요"));
  redirect("/home");
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const parsed = z
    .object({ email: z.string().email(), password: z.string().min(6), nickname: z.string().trim().min(1).max(24) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/login?mode=signup&error=" + encodeURIComponent("닉네임, 이메일, 6자 이상 비밀번호가 필요해요"));
  const { email, password, nickname } = parsed.data;
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nickname }, emailRedirectTo: `${origin}/auth/callback` } });
  if (error) redirect("/login?mode=signup&error=" + encodeURIComponent(error.message));
  if (!data.session) redirect("/login?notice=" + encodeURIComponent("확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요"));
  redirect("/home");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ------------------------------------------------------------- library
export async function addBook(formData: FormData) {
  const { supabase, user } = await requireUser();
  const f = Object.fromEntries(formData) as Record<string, string>;
  let bookId = f.bookId;

  if (!bookId) {
    const parsed = z
      .object({ title: z.string().min(1).max(300), author: z.string().max(300), externalId: z.string().min(1).max(100) })
      .safeParse(f);
    if (!parsed.success) redirect("/discover?error=1");
    const { data: existing } = await supabase.from("books").select("id").eq("source", "openlibrary").eq("external_id", f.externalId).maybeSingle();
    if (existing) bookId = existing.id;
    else {
      const isbn = /^[0-9]{13}$/.test(f.isbn13 ?? "") ? f.isbn13 : null;
      const { data: dupe } = isbn ? await supabase.from("books").select("id").eq("isbn13", isbn).maybeSingle() : { data: null };
      if (dupe) bookId = dupe.id;
      else {
        const { data: created, error } = await supabase
          .from("books")
          .insert({
            title: f.title, author: f.author || "작자 미상", published_year: f.year ? Number(f.year) : null,
            isbn13: isbn, cover_url: f.coverUrl || null, source: "openlibrary", external_id: f.externalId, created_by: user.id, scene_count: 10,
          })
          .select("id")
          .single();
        if (error || !created) redirect("/discover?error=1");
        bookId = created.id;
        await supabase.from("scenes").insert(Array.from({ length: 10 }, (_, i) => ({ book_id: bookId, idx: i + 1, title: `장면 ${i + 1}` })));
      }
    }
  }
  if (!uuid.safeParse(bookId).success) redirect("/discover?error=1");
  // PK(user_id, book_id)로 중복 등록 방지
  await supabase.from("user_books").upsert({ user_id: user.id, book_id: bookId, status: "reading" }, { onConflict: "user_id,book_id", ignoreDuplicates: true });
  revalidatePath("/library");
  redirect("/library?added=1");
}

export async function setStatus(bookId: string, status: "reading" | "paused" | "done") {
  const { supabase, user } = await requireUser();
  if (!uuid.safeParse(bookId).success || !["reading", "paused", "done"].includes(status)) return;
  await supabase.from("user_books").update({ status }).eq("user_id", user.id).eq("book_id", bookId);
  revalidatePath("/library");
}

export async function removeBook(bookId: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("user_books").delete().eq("user_id", user.id).eq("book_id", bookId);
  revalidatePath("/library");
}

// ------------------------------------------------------------- reading
export async function setScene(bookId: string, scene: number) {
  const { supabase, user } = await requireUser();
  if (!uuid.safeParse(bookId).success || !Number.isInteger(scene) || scene < 1) return;
  await supabase.from("user_books").update({ current_scene: scene, last_read_at: new Date().toISOString() }).eq("user_id", user.id).eq("book_id", bookId);
}

export async function startSession(bookId: string, trigger: "home" | "resume_card" | "notification" | "library" = "home", resumed = false) {
  const { supabase, user } = await requireUser();
  const { data: ub } = await supabase.from("user_books").select("current_scene").eq("user_id", user.id).eq("book_id", bookId).maybeSingle();
  const { data } = await supabase
    .from("reading_sessions")
    .insert({ user_id: user.id, book_id: bookId, scene_from: ub?.current_scene ?? null, trigger, resumed })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

export async function endSession(sessionId: string, bookId: string, sceneTo: number) {
  const { supabase, user } = await requireUser();
  await supabase.from("reading_sessions").update({ ended_at: new Date().toISOString(), scene_to: sceneTo }).eq("id", sessionId).eq("user_id", user.id);
  await supabase.from("user_books").update({ last_read_at: new Date().toISOString() }).eq("user_id", user.id).eq("book_id", bookId);
}

export async function checkIn(bookId: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("user_books").update({ status: "reading" }).eq("user_id", user.id).eq("book_id", bookId);
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).eq("book_id", bookId).is("read_at", null);
  const id = await startSession(bookId, "resume_card", true);
  redirect(`/read/${bookId}?session=${id ?? ""}`);
}

// --------------------------------------------------------------- notes
const noteSchema = z.object({
  bookId: uuid,
  sceneIdx: z.coerce.number().int().min(1),
  kind: z.enum(["quote", "scene", "hand_sim"]),
  quote: z.string().max(300).optional().default(""),
  description: z.string().max(300).optional().default(""),
  body: z.string().max(500).optional().default(""),
  visibility: z.enum(["private", "friends", "public"]),
});

export async function createNote(formData: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = noteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "입력을 확인해 주세요" };
  const emotions = formData.getAll("emotions").map(String).filter((e) => emotionIds.includes(e)).slice(0, 3);
  const d = parsed.data;
  const quote = d.quote.trim() || null;
  const description = d.description.trim() || null;
  let passageId: string | null = null;
  if (quote || description) {
    const { data: p, error } = await supabase
      .from("passages")
      .insert({ book_id: d.bookId, scene_idx: d.sceneIdx, kind: d.kind, quote, description, created_by: user.id })
      .select("id")
      .single();
    if (error) return { ok: false as const, error: "구절을 저장하지 못했어요" };
    passageId = p.id;
  }
  const { error } = await supabase.from("notes").insert({
    user_id: user.id, book_id: d.bookId, scene_idx: d.sceneIdx, passage_id: passageId, emotions, body: d.body.trim() || null, visibility: d.visibility,
  });
  if (error) return { ok: false as const, error: "감상을 저장하지 못했어요" };
  revalidatePath(`/books/${d.bookId}/scenes/${d.sceneIdx}`);
  return { ok: true as const };
}

export async function deleteNote(noteId: string, path: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("notes").delete().eq("id", noteId).eq("user_id", user.id);
  revalidatePath(path);
}

export async function toggleEmpathy(noteId: string, on: boolean, path: string) {
  const { supabase, user } = await requireUser();
  if (on) await supabase.from("reactions").upsert({ note_id: noteId, user_id: user.id }, { ignoreDuplicates: true });
  else await supabase.from("reactions").delete().eq("note_id", noteId).eq("user_id", user.id);
  revalidatePath(path);
}

export async function addComment(noteId: string, body: string, path: string) {
  const { supabase, user } = await requireUser();
  const text = body.trim().slice(0, 500);
  if (!text) return { ok: false };
  const { error } = await supabase.from("comments").insert({ note_id: noteId, user_id: user.id, body: text });
  revalidatePath(path);
  return { ok: !error };
}

// --------------------------------------------------------------- safety
export async function reportContent(targetType: "note" | "comment" | "question" | "chat_message" | "user", targetId: string, reason: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("reports").insert({ reporter: user.id, target_type: targetType, target_id: targetId, reason: reason.slice(0, 300) || "부적절한 내용" });
  return { ok: !error || error.code === "23505" };
}

export async function blockUser(userId: string, path = "/") {
  const { supabase, user } = await requireUser();
  if (userId === user.id) return;
  await supabase.from("blocks").upsert({ blocker: user.id, blocked: userId }, { ignoreDuplicates: true });
  await supabase.from("friendships").delete().or(`and(requester.eq.${user.id},addressee.eq.${userId}),and(requester.eq.${userId},addressee.eq.${user.id})`);
  revalidatePath(path);
}

export async function unblockUser(userId: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("blocks").delete().eq("blocker", user.id).eq("blocked", userId);
  revalidatePath("/settings");
}

// ---------------------------------------------------------------- chat
export async function requestChat(bookId: string, sceneIdx: number, addressee: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("chat_rooms")
    .insert({ book_id: bookId, scene_idx: sceneIdx, requester: user.id, addressee })
    .select("id")
    .single();
  if (error || !data) return { ok: false as const, error: "상대가 대화 요청을 받지 않거나 보낼 수 없어요" };
  return { ok: true as const, roomId: data.id as string };
}

export async function respondChat(roomId: string, accept: boolean) {
  const supabase = await createClient();
  await supabase.rpc("respond_chat", { p_room: roomId, p_accept: accept });
  revalidatePath("/connect");
  if (accept) redirect(`/chat/${roomId}`);
}

export async function closeChat(roomId: string, save: { bookId: string; sceneIdx: number; summary: string } | null) {
  const { supabase, user } = await requireUser();
  await supabase.rpc("close_chat", { p_room: roomId });
  if (save && save.summary.trim()) {
    // 대화 저장은 본인 선택 · 나만 보기 감상으로만 (상대 메시지 원문은 저장하지 않음)
    await supabase.from("notes").insert({
      user_id: user.id, book_id: save.bookId, scene_idx: save.sceneIdx, body: save.summary.trim().slice(0, 500), visibility: "private", emotions: [],
    });
  }
  revalidatePath("/connect");
}

// ----------------------------------------------------------- questions
export async function publishQuestions(bookId: string, sceneIdx: number, items: { text: string; type: string; source: "ai" | "user" }[]) {
  const { supabase, user } = await requireUser();
  const rows = items
    .map((q) => ({ text: q.text.trim().slice(0, 300), type: q.type, source: q.source }))
    .filter((q) => q.text)
    .slice(0, 3)
    .map((q) => ({
      user_id: user.id, book_id: bookId, scene_idx: sceneIdx, body: q.text,
      source: q.source, qtype: ["emotion", "interpretation", "perspective"].includes(q.type) ? q.type : "other", visibility: "public",
    }));
  if (!rows.length) return { ok: false };
  const { error } = await supabase.from("questions").insert(rows);
  revalidatePath(`/books/${bookId}/scenes/${sceneIdx}`);
  return { ok: !error };
}

// ------------------------------------------------------------- friends
export async function requestFriend(formData: FormData) {
  const { supabase, user } = await requireUser();
  const nickname = String(formData.get("nickname") ?? "").trim();
  if (!nickname) redirect("/connect?friend=empty");
  const { data: target } = await supabase.from("public_profiles").select("id").eq("nickname", nickname).neq("id", user.id).limit(1).maybeSingle();
  if (!target) redirect("/connect?friend=notfound");
  const { error } = await supabase.from("friendships").insert({ requester: user.id, addressee: target.id });
  redirect(`/connect?friend=${error ? "exists" : "sent"}`);
}

export async function respondFriend(id: string, accept: boolean) {
  const { supabase, user } = await requireUser();
  if (accept) await supabase.from("friendships").update({ status: "accepted" }).eq("id", id).eq("addressee", user.id);
  else await supabase.from("friendships").delete().eq("id", id);
  revalidatePath("/connect");
}

// ------------------------------------------------------------ settings
export async function updatePrefs(formData: FormData) {
  const { supabase, user } = await requireUser();
  const bool = (k: string) => formData.get(k) === "on";
  const vis = String(formData.get("default_visibility"));
  const nickname = String(formData.get("nickname") ?? "").trim().slice(0, 24);
  await supabase
    .from("profiles")
    .update({
      ...(nickname ? { nickname } : {}),
      share_progress_with_friends: bool("share_progress_with_friends"),
      allow_chat_requests: bool("allow_chat_requests"),
      light_notifications: bool("light_notifications"),
      reduce_motion: bool("reduce_motion"),
      default_visibility: ["private", "friends", "public"].includes(vis) ? vis : "public",
    })
    .eq("id", user.id);
  revalidatePath("/", "layout");
  redirect("/settings?saved=1");
}

export async function deleteMyContent() {
  const supabase = await createClient();
  await supabase.rpc("delete_my_content");
  revalidatePath("/", "layout");
  redirect("/settings?deleted=1");
}

export async function markNotificationsRead() {
  const { supabase, user } = await requireUser();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  revalidatePath("/home");
}

// -------------------------------------------------------------- device
const stateEnum = z.enum(HORONG_STATES);
export async function saveDevice(status: { connected: boolean; brightness: number; focusMode: boolean; lightState: string }, event: string, payload: Record<string, unknown> = {}) {
  const { supabase, user } = await requireUser();
  const light = stateEnum.safeParse(status.lightState);
  let { data: dev } = await supabase.from("devices").select("id").eq("user_id", user.id).eq("kind", "virtual").maybeSingle();
  const row = {
    user_id: user.id, kind: "virtual", connected: status.connected, brightness: Math.max(0, Math.min(100, Math.round(status.brightness))),
    focus_mode: status.focusMode, light_state: light.success ? light.data : "idle", battery: 82, firmware: "sim-0.1", updated_at: new Date().toISOString(),
  };
  if (dev) await supabase.from("devices").update(row).eq("id", dev.id);
  else ({ data: dev } = await supabase.from("devices").insert(row).select("id").single());
  if (dev) await supabase.from("device_events").insert({ device_id: dev.id, user_id: user.id, event_type: event, payload });
}
