import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { computeNextRunAt } from "@/lib/scheduler/time";

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
      .select("workspace_id, status, send_at, recurrence_cron, timezone")
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

    if (schedule.status === "active") {
      return NextResponse.json({ message: "Schedule already active" });
    }

    if (schedule.status === "completed" || schedule.status === "cancelled") {
      return NextResponse.json(
        { error: "Cannot resume completed or cancelled schedule" },
        { status: 400 }
      );
    }

    // Recompute next_run_at
    const nextRunAt = computeNextRunAt(
      schedule.send_at,
      schedule.recurrence_cron,
      schedule.timezone
    );

    // Resume schedule
    const { data: updatedSchedule, error: updateError } = await supabase
      .from("scheduled_messages")
      .update({
        status: "active",
        next_run_at: nextRunAt ? nextRunAt.toISOString() : null,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ schedule: updatedSchedule });
  } catch (error) {
    console.error("Error resuming schedule:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
