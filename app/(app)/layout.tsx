export const dynamic = "force-dynamic";

import { requireUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: device }] = await Promise.all([
    supabase.from("profiles").select("nickname, reduce_motion, light_notifications").eq("id", user.id).single(),
    supabase.from("devices").select("connected, brightness, focus_mode, light_state").eq("user_id", user.id).eq("kind", "virtual").maybeSingle(),
  ]);
  return (
    <AppShell
      userId={user.id}
      reduceMotion={profile?.reduce_motion ?? false}
      lightNotifications={profile?.light_notifications ?? true}
      device={device ? { connected: device.connected, brightness: device.brightness, focusMode: device.focus_mode, lightState: device.light_state } : null}
    >
      {children}
    </AppShell>
  );
}
