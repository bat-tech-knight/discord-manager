import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { EditorSidebar } from "@/components/EditorSidebar";

export default async function UtilityTools() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return (
    <div className="h-screen flex bg-discord-message-area overflow-hidden">
      <EditorSidebar />
      <div className="flex-1 flex items-center justify-center text-discord-text-muted">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Utility Tools</h2>
          <p className="text-sm">Coming soon...</p>
        </div>
      </div>
    </div>
  );
}

