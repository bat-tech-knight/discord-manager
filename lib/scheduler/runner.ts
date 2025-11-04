import { createClient } from "@supabase/supabase-js";
import { sendDiscordMessage } from "@/lib/discord/webhook";
import { computeNextRunAt } from "./time";

/**
 * Service role client for bypassing RLS in the runner
 */
function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase service role configuration");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

interface ScheduledMessageRow {
  id: string;
  workspace_id: string;
  channel_id: string;
  saved_message_id: string | null;
  payload: any;
  recurrence_cron: string | null;
  send_at: string | null;
  timezone: string;
  status: string;
  last_run_at: string | null;
  next_run_at: string | null;
  max_runs: number | null;
  run_count: number;
}

/**
 * Processes a single scheduled message
 */
export async function processScheduledMessage(
  schedule: ScheduledMessageRow,
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<void> {
  const startedAt = new Date();

  try {
    // Get channel with webhook URL
    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .select("webhook_url, webhook_username, webhook_avatar_url")
      .eq("id", schedule.channel_id)
      .single();

    if (channelError || !channel || !channel.webhook_url) {
      throw new Error(
        `Channel not found or webhook URL not configured: ${channelError?.message || "Unknown error"}`
      );
    }

    // Build message payload
    let content: string | undefined;
    let embeds: any[] | undefined;

    if (schedule.saved_message_id) {
      // Try to load from templates first (new approach)
      const { data: template } = await supabase
        .from("templates")
        .select("message_data, content, embed_data")
        .eq("id", schedule.saved_message_id)
        .single();

      if (template) {
        // Use message_data if available (preferred), otherwise fall back to legacy fields
        const md = template.message_data;
        if (md) {
          content = md.content || undefined;
          if (md.embeds) {
            embeds = Array.isArray(md.embeds) ? md.embeds : [md.embeds];
          }
        } else {
          // Fall back to legacy template structure
          content = template.content || undefined;
          if (template.embed_data) {
            if (Array.isArray(template.embed_data)) {
              embeds = template.embed_data;
            } else if (template.embed_data.embeds && Array.isArray(template.embed_data.embeds)) {
              embeds = template.embed_data.embeds;
            } else {
              embeds = [template.embed_data];
            }
          }
        }
      } else {
        // Fall back to messages table for backward compatibility
        const { data: message, error: messageError } = await supabase
          .from("messages")
          .select("content, embed_data")
          .eq("id", schedule.saved_message_id)
          .single();

        if (messageError || !message) {
          throw new Error(
            `Saved message or template not found: ${messageError?.message || "Unknown error"}`
          );
        }

        content = message.content || undefined;
        if (message.embed_data) {
          // Handle both single embed and embeds array
          if (Array.isArray(message.embed_data)) {
            embeds = message.embed_data;
          } else if (message.embed_data.embeds && Array.isArray(message.embed_data.embeds)) {
            embeds = message.embed_data.embeds;
          } else {
            embeds = [message.embed_data];
          }
        }
      }
    } else if (schedule.payload) {
      // Use snapshot payload
      const payload = schedule.payload;
      content = payload.content || undefined;
      if (payload.embeds) {
        embeds = Array.isArray(payload.embeds) ? payload.embeds : [payload.embeds];
      } else if (payload.embed_data) {
        embeds = Array.isArray(payload.embed_data)
          ? payload.embed_data
          : [payload.embed_data];
      }
    }

    if (!content && (!embeds || embeds.length === 0)) {
      throw new Error("Message has no content or embeds");
    }

    // Send message to Discord
    const result = await sendDiscordMessage({
      webhookUrl: channel.webhook_url,
      content,
      embeds,
      username: channel.webhook_username || undefined,
      avatarUrl: channel.webhook_avatar_url || undefined,
    });

    if (!result.success) {
      throw new Error(result.error || "Failed to send message");
    }

    const finishedAt = new Date();

    // Log successful run
    await supabase.from("scheduled_message_runs").insert({
      scheduled_message_id: schedule.id,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      success: true,
      discord_message_id: result.discordMessageId || null,
    });

    // Update schedule
    const isRecurring = !!schedule.recurrence_cron;
    const newRunCount = schedule.run_count + 1;
    const hasReachedMaxRuns = schedule.max_runs !== null && newRunCount >= schedule.max_runs;

    let nextRunAt: string | null = null;
    let status = schedule.status;

    if (hasReachedMaxRuns) {
      status = "completed";
    } else if (isRecurring) {
      // Compute next run for recurring schedule
      const nextRun = computeNextRunAt(
        null,
        schedule.recurrence_cron,
        schedule.timezone,
        finishedAt
      );
      nextRunAt = nextRun ? nextRun.toISOString() : null;
    } else {
      // One-time schedule is now complete
      status = "completed";
    }

    await supabase
      .from("scheduled_messages")
      .update({
        last_run_at: finishedAt.toISOString(),
        next_run_at: nextRunAt,
        run_count: newRunCount,
        status,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", schedule.id);
  } catch (error) {
    const finishedAt = new Date();
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Log failed run
    await supabase.from("scheduled_message_runs").insert({
      scheduled_message_id: schedule.id,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      success: false,
      error: errorMessage,
    });

    // Update schedule with error
    const isRecurring = !!schedule.recurrence_cron;

    let nextRunAt: string | null = null;
    if (isRecurring) {
      // For recurring, retry in 5 minutes or compute next based on cron
      const retryDate = new Date(finishedAt.getTime() + 5 * 60 * 1000);
      nextRunAt = retryDate.toISOString();
    }

    await supabase
      .from("scheduled_messages")
      .update({
        last_run_at: finishedAt.toISOString(),
        next_run_at: nextRunAt,
        last_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", schedule.id);

    console.error(`Failed to process scheduled message ${schedule.id}:`, errorMessage);
  }
}

/**
 * Processes all due scheduled messages
 */
export async function processDueScheduledMessages(): Promise<{
  processed: number;
  errors: number;
}> {
  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();

  // Select due messages with FOR UPDATE SKIP LOCKED to prevent duplicate processing
  const { data: schedules, error } = await supabase
    .from("scheduled_messages")
    .select("*")
    .eq("status", "active")
    .lte("next_run_at", now)
    .order("next_run_at", { ascending: true })
    .limit(50); // Process up to 50 at a time

  if (error) {
    console.error("Error fetching due scheduled messages:", error);
    return { processed: 0, errors: 1 };
  }

  if (!schedules || schedules.length === 0) {
    return { processed: 0, errors: 0 };
  }

  let processed = 0;
  let errors = 0;

  // Process each schedule (serial to avoid rate limits)
  for (const schedule of schedules) {
    try {
      // Use SELECT FOR UPDATE SKIP LOCKED equivalent by updating next_run_at immediately
      // This prevents another runner from picking up the same message
      const tempNextRun = new Date(Date.now() + 60000).toISOString(); // 1 minute in future
      const { error: lockError } = await supabase
        .from("scheduled_messages")
        .update({ next_run_at: tempNextRun })
        .eq("id", schedule.id)
        .eq("next_run_at", schedule.next_run_at);

      if (lockError) {
        // Another runner got this one, skip
        continue;
      }

      await processScheduledMessage(
        schedule as ScheduledMessageRow,
        supabase
      );
      processed++;
    } catch (error) {
      console.error(`Error processing schedule ${schedule.id}:`, error);
      errors++;
    }
  }

  return { processed, errors };
}
