import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, x-apikey, content-type",
};

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

// Simple cron parser for Deno (basic support)
function parseCron(cronExpr: string, baseDate: Date, timezone: string): Date {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error("Invalid cron expression format");
  }

  const [minute, hour, day, month, weekday] = parts;
  const next = new Date(baseDate);
  
  // For simplicity, we'll advance to next occurrence
  // Full cron parsing would be complex - consider using a library
  // For now, handle common patterns
  
  if (minute !== "*" && hour !== "*") {
    // Specific time pattern
    next.setMinutes(parseInt(minute) || 0);
    next.setHours(parseInt(hour) || 0);
    if (next <= baseDate) {
      next.setDate(next.getDate() + 1);
    }
  } else if (hour === "*" && minute === "*") {
    next.setMinutes(next.getMinutes() + 1);
  } else if (hour !== "*" && minute === "*") {
    next.setMinutes(0);
    next.setHours(parseInt(hour) || 0);
    if (next <= baseDate) {
      next.setDate(next.getDate() + 1);
    }
  } else {
    // Default: advance by hour
    next.setHours(next.getHours() + 1);
    next.setMinutes(0);
  }
  
  next.setSeconds(0);
  next.setMilliseconds(0);
  
  return next;
}

function computeNextRunAt(
  sendAt: Date | string | null,
  recurrenceCron: string | null,
  timezone: string = "UTC",
  lastRunAt?: Date | string | null
): Date | null {
  try {
    // One-time schedule
    if (sendAt && !recurrenceCron) {
      const sendDate = typeof sendAt === "string" ? new Date(sendAt) : sendAt;
      if (isNaN(sendDate.getTime())) return null;
      return sendDate;
    }

    // Recurring schedule
    if (recurrenceCron && !sendAt) {
      const baseDate = lastRunAt
        ? typeof lastRunAt === "string"
          ? new Date(lastRunAt)
          : lastRunAt
        : new Date();
      
      try {
        return parseCron(recurrenceCron, baseDate, timezone);
      } catch {
        // If parsing fails, default to next hour
        const next = new Date(baseDate);
        next.setHours(next.getHours() + 1);
        next.setMinutes(0);
        next.setSeconds(0);
        return next;
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function processScheduledMessage(
  schedule: ScheduledMessageRow,
  supabase: any
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
    const webhookUrl = new URL(channel.webhook_url);
    webhookUrl.searchParams.set("wait", "true");
    
    const discordPayload: any = {};
    if (content) discordPayload.content = content;
    if (embeds) discordPayload.embeds = embeds;
    if (channel.webhook_username) discordPayload.username = channel.webhook_username;
    if (channel.webhook_avatar_url) discordPayload.avatar_url = channel.webhook_avatar_url;

    const discordResponse = await fetch(webhookUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordPayload),
    });

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      throw new Error(`Discord API error: ${discordResponse.status} ${errorText}`);
    }

    let discordMessageId: string | undefined;
    try {
      const messageData = await discordResponse.json();
      discordMessageId = messageData?.id;
    } catch {
      // Response might be empty, which is fine
    }

    const finishedAt = new Date();

    // Save message to messages table for history
    const embedDataForDb = embeds && embeds.length > 0 
      ? (embeds.length === 1 ? embeds[0] : { embeds: embeds })
      : null;

    try {
      const { error: messageInsertError } = await supabase
        .from("messages")
        .insert({
          channel_id: schedule.channel_id,
          content: content || null,
          embed_data: embedDataForDb,
          discord_message_id: discordMessageId || null,
          sent_at: finishedAt.toISOString(),
        });

      if (messageInsertError) {
        console.error(`Failed to save message to history: ${messageInsertError.message}`);
        // Don't fail the entire process - message was already sent to Discord
      }
    } catch (error) {
      console.error(`Error saving message to history: ${error}`);
      // Don't fail the entire process - message was already sent to Discord
    }

    // Log successful run
    await supabase.from("scheduled_message_runs").insert({
      scheduled_message_id: schedule.id,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      success: true,
      discord_message_id: discordMessageId || null,
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
        updated_at: finishedAt.toISOString(),
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
      // For recurring, retry in 5 minutes
      const retryDate = new Date(finishedAt.getTime() + 5 * 60 * 1000);
      nextRunAt = retryDate.toISOString();
    }

    await supabase
      .from("scheduled_messages")
      .update({
        last_run_at: finishedAt.toISOString(),
        next_run_at: nextRunAt,
        last_error: errorMessage,
        updated_at: finishedAt.toISOString(),
      })
      .eq("id", schedule.id);

    console.error(`Failed to process scheduled message ${schedule.id}:`, errorMessage);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log(`[${new Date().toISOString()}] Edge Function called: ${req.method} ${req.url}`);

  try {
    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current time
    const now = new Date().toISOString();
    console.log(`[${new Date().toISOString()}] Processing scheduled messages. Current UTC time: ${now}`);

    // Find due scheduled messages
    const { data: schedules, error } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("status", "active")
      .lte("next_run_at", now)
      .order("next_run_at", { ascending: true })
      .limit(50);

    if (error) {
      console.error("Error fetching due scheduled messages:", error);
      return new Response(
        JSON.stringify({ error: error.message, processed: 0, errors: 1 }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Found ${schedules?.length || 0} due scheduled messages`);
    if (schedules && schedules.length > 0) {
      console.log(`Messages due:`, schedules.map(s => ({ id: s.id, name: s.name, next_run_at: s.next_run_at })));
    }

    if (!schedules || schedules.length === 0) {
      // Debug: check if there are any active messages at all
      const { data: allActive } = await supabase
        .from("scheduled_messages")
        .select("id, name, status, next_run_at")
        .eq("status", "active")
        .limit(10);
      console.log(`Total active messages in DB: ${allActive?.length || 0}`);
      if (allActive && allActive.length > 0) {
        console.log(`Active messages (may not be due yet):`, allActive.map(s => ({ 
          id: s.id, 
          name: s.name, 
          next_run_at: s.next_run_at,
          is_due: s.next_run_at <= now
        })));
      }
      
      return new Response(
        JSON.stringify({ processed: 0, errors: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let processed = 0;
    let errors = 0;

    // Process each schedule
    for (const schedule of schedules as ScheduledMessageRow[]) {
      try {
        // Lock the schedule by updating next_run_at
        const tempNextRun = new Date(Date.now() + 60000).toISOString();
        const { error: lockError } = await supabase
          .from("scheduled_messages")
          .update({ next_run_at: tempNextRun })
          .eq("id", schedule.id)
          .eq("next_run_at", schedule.next_run_at);

        if (lockError) {
          // Another process got this one, skip
          continue;
        }

        await processScheduledMessage(schedule, supabase);
        processed++;
      } catch (error) {
        console.error(`Error processing schedule ${schedule.id}:`, error);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ processed, errors }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in process-scheduled-messages function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        processed: 0,
        errors: 1,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
