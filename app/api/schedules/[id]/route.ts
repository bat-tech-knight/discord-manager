import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { computeNextRunAt, validateCronExpression } from "@/lib/scheduler/time";

const updateScheduleSchema = z.object({
  name: z.string().min(1).max(32).optional(),
  saved_message_id: z.string().uuid().optional().nullable(),
  payload: z.any().optional().nullable(),
  send_at: z.string().datetime().optional().nullable(),
  recurrence_cron: z.string().optional().nullable(),
  timezone: z.string().optional(),
  max_runs: z.number().int().positive().optional().nullable(),
  status: z.enum(["active", "paused", "completed", "cancelled"]).optional(),
});

export async function PATCH(
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

    const body = await request.json();
    const validation = updateScheduleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Get existing schedule and verify ownership
    const { data: schedule, error: scheduleError } = await supabase
      .from("scheduled_messages")
      .select("workspace_id, saved_message_id, payload, send_at, recurrence_cron, timezone, status")
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

    // Prepare update data
    const updateData: any = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.saved_message_id !== undefined || data.payload !== undefined) {
      // Ensure at least one message source
      const newSavedMessageId = data.saved_message_id !== undefined 
        ? data.saved_message_id 
        : schedule.saved_message_id;
      const newPayload = data.payload !== undefined 
        ? data.payload 
        : schedule.payload;

      if (!newSavedMessageId && !newPayload) {
        return NextResponse.json(
          { error: "Either saved_message_id or payload is required" },
          { status: 400 }
        );
      }

      if (data.saved_message_id !== undefined) {
        // Validate saved_message_id exists (template or message)
        const { data: template } = await supabase
          .from("templates")
          .select("id")
          .eq("id", newSavedMessageId)
          .eq("user_id", user.id)
          .single();
        
        if (!template) {
          // Fall back to messages table for backward compatibility
          const { data: message } = await supabase
            .from("messages")
            .select("id")
            .eq("id", newSavedMessageId)
            .single();
          if (!message) {
            return NextResponse.json(
              { error: "Saved message or template not found" },
              { status: 404 }
            );
          }
        }
        updateData.saved_message_id = newSavedMessageId;
      }
      if (data.payload !== undefined) {
        updateData.payload = newPayload;
      }
    }

    if (data.send_at !== undefined || data.recurrence_cron !== undefined) {
      const newSendAt = data.send_at !== undefined ? data.send_at : schedule.send_at;
      const newRecurrenceCron = data.recurrence_cron !== undefined 
        ? data.recurrence_cron 
        : schedule.recurrence_cron;

      // Validate that both are not set
      if (newSendAt && newRecurrenceCron) {
        return NextResponse.json(
          { error: "Cannot provide both send_at and recurrence_cron" },
          { status: 400 }
        );
      }

      // Validate cron expression if provided
      if (newRecurrenceCron && !validateCronExpression(newRecurrenceCron)) {
        return NextResponse.json(
          { error: "Invalid cron expression" },
          { status: 400 }
        );
      }

      updateData.send_at = newSendAt;
      updateData.recurrence_cron = newRecurrenceCron;
    }

    if (data.timezone !== undefined) {
      updateData.timezone = data.timezone;
    }

    if (data.max_runs !== undefined) {
      updateData.max_runs = data.max_runs;
    }

    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    // Recompute next_run_at if schedule parameters changed
    if (
      data.send_at !== undefined ||
      data.recurrence_cron !== undefined ||
      data.timezone !== undefined ||
      data.status !== undefined
    ) {
      const finalSendAt = updateData.send_at ?? schedule.send_at;
      const finalRecurrenceCron = updateData.recurrence_cron ?? schedule.recurrence_cron;
      const finalTimezone = updateData.timezone ?? schedule.timezone;
      const finalStatus = updateData.status ?? schedule.status;

      if (finalStatus === "active") {
        const nextRunAt = computeNextRunAt(
          finalSendAt ?? null,
          finalRecurrenceCron ?? null,
          finalTimezone ?? "UTC"
        );

        if (nextRunAt) {
          updateData.next_run_at = nextRunAt.toISOString();
        }
      } else {
        updateData.next_run_at = null;
      }
    }

    // Update schedule
    const { data: updatedSchedule, error: updateError } = await supabase
      .from("scheduled_messages")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ schedule: updatedSchedule });
  } catch (error) {
    console.error("Error updating schedule:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
      .select("workspace_id")
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

    // Delete schedule (cascade will delete runs)
    const { error: deleteError } = await supabase
      .from("scheduled_messages")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting schedule:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
