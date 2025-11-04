import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { processScheduledMessage } from "@/lib/scheduler/runner";
import { createClient as createServiceRoleClient } from "@supabase/supabase-js";

function createServiceRoleSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase service role configuration");
  }

  return createServiceRoleClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get schedule and verify ownership
    const { data: schedule, error: scheduleError } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("id", id)
      .single();

    if (scheduleError || !schedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    // Verify workspace belongs to user
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", schedule.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    if (schedule.status === "completed" || schedule.status === "cancelled") {
      return NextResponse.json(
        { error: "Cannot run completed or cancelled schedule" },
        { status: 400 }
      );
    }

    // Process the schedule immediately using service role client
    const serviceClient = createServiceRoleSupabaseClient();
    await processScheduledMessage(schedule as any, serviceClient);

    return NextResponse.json({ 
      success: true,
      message: "Schedule executed successfully" 
    });
  } catch (error) {
    console.error("Error running schedule:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
