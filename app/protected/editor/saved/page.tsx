import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SavedMessagesPage } from "@/components/SavedMessagesPage";

export default async function SavedMessages() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return <SavedMessagesPage />;
}

