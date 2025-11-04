import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ScheduledMessagesPage } from "@/components/ScheduledMessagesPage";

export default async function ScheduledPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/auth/login");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const first = workspaces?.[0];
  if (!first) {
    return <div className="p-8 text-center text-gray-400">No workspaces yet</div> as any;
  }

  return <ScheduledMessagesPage workspaceId={first.id} workspaceName={first.name} />;
}


