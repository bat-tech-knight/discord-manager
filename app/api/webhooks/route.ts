import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  sendDiscordMessage,
  editWebhookMessage,
  validateWebhookUrl,
  extractMessageId,
} from "@/lib/discord/webhook";

async function parseJsonSafe(request: Request): Promise<any | null> {
  try {
    const raw = await request.text();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonSafe(request);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const {
      webhook_url,
      thread_id,
      message_id,
      content,
      embeds,
      components,
      username,
      avatar_url,
    } = body;

    if (!webhook_url) {
      return NextResponse.json(
        { error: "webhook_url is required" },
        { status: 400 }
      );
    }

    // Validate webhook URL
    if (!validateWebhookUrl(webhook_url)) {
      return NextResponse.json(
        { error: "Invalid webhook URL format" },
        { status: 400 }
      );
    }

    // If message_id is provided, this is an edit operation
    if (message_id) {
      const result = await editWebhookMessage(
        webhook_url,
        message_id,
        {
          content: content || undefined,
          embeds: embeds || undefined,
          username: username || undefined,
          avatarUrl: avatar_url || undefined,
        }
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to edit message" },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { message: result.message || "Message edited successfully" },
        { status: 200 }
      );
    }

    // Prepare embeds - convert color if needed
    let discordEmbeds: any[] | undefined;
    if (embeds && Array.isArray(embeds)) {
      discordEmbeds = embeds.map((embed: any) => {
        if (embed.color && typeof embed.color === "string") {
          return {
            ...embed,
            color: parseInt(embed.color.replace("#", ""), 16),
          };
        }
        return embed;
      });
    }

    // Build payload for webhook
    const result = await sendDiscordMessage({
      webhookUrl: webhook_url,
      content: content || undefined,
      username: username || undefined,
      avatarUrl: avatar_url || undefined,
      embeds: discordEmbeds,
      threadId: thread_id || undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send message" },
        { status: 500 }
      );
    }

    // Try to persist created message in database if channel exists for this webhook URL
    try {
      const supabase = await createClient();
      const { data: channel, error: channelError } = await supabase
        .from("channels")
        .select("id")
        .eq("webhook_url", webhook_url)
        .single();

      if (!channelError && channel?.id) {
        const embedDataForDb = discordEmbeds && discordEmbeds.length > 0
          ? (discordEmbeds.length === 1 ? discordEmbeds[0] : { embeds: discordEmbeds })
          : null;

        await supabase.from("messages").insert({
          channel_id: channel.id,
          content: content || null,
          embed_data: embedDataForDb,
          discord_message_id: result.discordMessageId || null,
        });
      }
    } catch (e) {
      // Ignore persistence errors to not block webhook success
      console.warn("/api/webhooks POST: failed to persist message:", e);
    }

    return NextResponse.json(
      {
        message: result.message || "Message sent successfully",
        discord_message_id: result.discordMessageId || null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("/api/webhooks POST failed:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await parseJsonSafe(request);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const {
      webhook_url,
      message_id,
      content,
      embeds,
      username,
      avatar_url,
    } = body;

    if (!webhook_url || !message_id) {
      return NextResponse.json(
        { error: "webhook_url and message_id are required" },
        { status: 400 }
      );
    }

    // Validate webhook URL
    if (!validateWebhookUrl(webhook_url)) {
      return NextResponse.json(
        { error: "Invalid webhook URL format" },
        { status: 400 }
      );
    }

    // Prepare embeds - convert color if needed
    let discordEmbeds: any[] | undefined;
    if (embeds && Array.isArray(embeds)) {
      discordEmbeds = embeds.map((embed: any) => {
        if (embed.color && typeof embed.color === "string") {
          return {
            ...embed,
            color: parseInt(embed.color.replace("#", ""), 16),
          };
        }
        return embed;
      });
    }

    const result = await editWebhookMessage(webhook_url, message_id, {
      content: content || undefined,
      embeds: discordEmbeds,
      username: username || undefined,
      avatarUrl: avatar_url || undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to edit message" },
        { status: 500 }
      );
    }

    // Try to update stored message if exists
    try {
      const supabase = await createClient();
      const extractedMessageId = extractMessageId(message_id);
      if (extractedMessageId) {
        const { data: channel, error: channelError } = await supabase
          .from("channels")
          .select("id")
          .eq("webhook_url", webhook_url)
          .single();

        if (!channelError && channel?.id) {
          const embedDataForDb = discordEmbeds && discordEmbeds.length > 0
            ? (discordEmbeds.length === 1 ? discordEmbeds[0] : { embeds: discordEmbeds })
            : null;

          await supabase
            .from("messages")
            .update({
              content: content || null,
              embed_data: embedDataForDb,
            })
            .eq("channel_id", channel.id)
            .eq("discord_message_id", extractedMessageId);
        }
      }
    } catch (e) {
      // Ignore persistence errors to not block webhook success
      console.warn("/api/webhooks PATCH: failed to update persisted message:", e);
    }

    return NextResponse.json(
      { message: result.message || "Message edited successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("/api/webhooks PATCH failed:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

