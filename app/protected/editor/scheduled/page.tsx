import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditorSidebar } from "@/components/EditorSidebar";
import { ScheduledMessagesPage } from "@/components/ScheduledMessagesPage";

export default async function ScheduledMessages() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const first = workspaces?.[0];
  if (!first) {
    return (
      <div className="h-screen flex bg-discord-message-area overflow-hidden">
        <EditorSidebar />
        <div className="flex-1 flex items-center justify-center text-discord-text-muted">
          <div className="text-center">
            <p className="text-sm">No workspaces yet</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-discord-message-area overflow-hidden">
      <EditorSidebar />
      <div className="flex-1 overflow-hidden">
        <ScheduledMessagesPage workspaceId={first.id} workspaceName={first.name} />
      </div>
    </div>
  );
}

