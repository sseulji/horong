export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { hasSupabase, createClient } from "@/lib/supabase/server";
import { Onboarding } from "@/components/Onboarding";

export default async function Splash() {
  if (hasSupabase) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect("/home");
  }
  return <Onboarding />;
}
