import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { computeNextRunAt, validateCronExpression } from "@/lib/scheduler/time";

const MAX_SCHEDULES_PER_WORKSPACE = 5;

const createScheduleSchema = z.object({
  workspace_id: z.string().uuid(),
  channel_id: z.string().uuid(),
  saved_message_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(32),
  payload: z.any().optional().nullable(),
  send_at: z.string().datetime().optional().nullable(),
  recurrence_cron: z.string().optional().nullable(),
  timezone: z.string().default("UTC"),
  max_runs: z.number().int().positive().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspace_id");
    if (!workspaceId) return NextResponse.json({ error: "workspace_id is required" }, { status: 400 });

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId)
      .eq("user_id", user.id)
      .single();
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const { data: schedules, error } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ schedules: schedules || [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const validation = createScheduleSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 });
    }
    const data = validation.data;

    if (!data.send_at && !data.recurrence_cron)
      return NextResponse.json({ error: "Either send_at or recurrence_cron is required" }, { status: 400 });
    if (data.send_at && data.recurrence_cron)
      return NextResponse.json({ error: "Cannot provide both send_at and recurrence_cron" }, { status: 400 });
    if (!data.saved_message_id && !data.payload)
      return NextResponse.json({ error: "Either saved_message_id or payload is required" }, { status: 400 });
    if (data.recurrence_cron && !validateCronExpression(data.recurrence_cron))
      return NextResponse.json({ error: "Invalid cron expression" }, { status: 400 });

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", data.workspace_id)
      .eq("user_id", user.id)
      .single();
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const { count } = await supabase
      .from("scheduled_messages")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", data.workspace_id)
      .in("status", ["active", "paused"]);
    if ((count || 0) >= MAX_SCHEDULES_PER_WORKSPACE)
      return NextResponse.json({ error: `Maximum ${MAX_SCHEDULES_PER_WORKSPACE} scheduled messages per workspace` }, { status: 403 });

    const { data: channel } = await supabase
      .from("channels")
      .select("id")
      .eq("id", data.channel_id)
      .eq("workspace_id", data.workspace_id)
      .single();
    if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

    if (data.saved_message_id) {
      // Check templates first (new approach), then messages (backward compatibility)
      const { data: template } = await supabase
        .from("templates")
        .select("id")
        .eq("id", data.saved_message_id)
        .eq("user_id", user.id)
        .single();
      
      if (!template) {
        // Fall back to messages table for backward compatibility
        const { data: message } = await supabase
          .from("messages")
          .select("id")
          .eq("id", data.saved_message_id)
          .single();
        if (!message) {
          return NextResponse.json({ error: "Saved message or template not found" }, { status: 404 });
        }
      }
    }

    const nextRunAt = computeNextRunAt(data.send_at ?? null, data.recurrence_cron ?? null, data.timezone);
    if (!nextRunAt) return NextResponse.json({ error: "Failed to compute next run time" }, { status: 400 });

    const { data: schedule, error: insertError } = await supabase
      .from("scheduled_messages")
      .insert({
        workspace_id: data.workspace_id,
        channel_id: data.channel_id,
        saved_message_id: data.saved_message_id || null,
        name: data.name,
        payload: data.payload || null,
        send_at: data.send_at || null,
        recurrence_cron: data.recurrence_cron || null,
        timezone: data.timezone,
        status: "active",
        next_run_at: nextRunAt.toISOString(),
        max_runs: data.max_runs || null,
        created_by: user.id,
      })
      .select()
      .single();
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    return NextResponse.json({ schedule }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
