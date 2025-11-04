import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { EmbedEditor } from "@/components/EmbedEditor";

export default async function EditorPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return <EmbedEditor />;
}

