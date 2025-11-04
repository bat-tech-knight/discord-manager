import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
      .select("workspace_id, status")
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

    if (schedule.status === "paused") {
      return NextResponse.json({ message: "Schedule already paused" });
    }

    // Pause schedule
    const { data: updatedSchedule, error: updateError } = await supabase
      .from("scheduled_messages")
      .update({ status: "paused" })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ schedule: updatedSchedule });
  } catch (error) {
    console.error("Error pausing schedule:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
