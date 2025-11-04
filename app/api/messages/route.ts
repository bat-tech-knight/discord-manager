import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendDiscordMessage, editWebhookMessage, extractMessageId } from "@/lib/discord/webhook";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channel_id");
    const id = searchParams.get("id");

    if (id) {
      const { data: message, error } = await supabase
        .from("messages")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ message });
    }

    if (!channelId) {
      return NextResponse.json(
        { error: "channel_id is required" },
        { status: 400 }
      );
    }

    const { data: messages, error } = await supabase
      .from("messages")
      .select("*")
      .eq("channel_id", channelId)
      .order("sent_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const {
      channel_id,
      content,
      embed_data,
      embeds,
      components,
      webhook_username,
      webhook_avatar_url,
    } = body;

    if (!channel_id) {
      return NextResponse.json(
        { error: "channel_id is required" },
        { status: 400 }
      );
    }

    // Get channel with webhook URL
    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .select("webhook_url, webhook_username, webhook_avatar_url")
      .eq("id", channel_id)
      .single();

    if (channelError || !channel) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 }
      );
    }

    // Prepare embed data - support both single embed_data (legacy) and embeds array
    let discordEmbeds: any[] | undefined;
    if (embeds && Array.isArray(embeds)) {
      discordEmbeds = embeds;
    } else if (embed_data) {
      discordEmbeds = [embed_data];
    }

    // Build payload for webhook
    const payload: any = {
      webhookUrl: channel.webhook_url,
      content: content || undefined,
      username: webhook_username || channel.webhook_username || undefined,
      avatarUrl: webhook_avatar_url || channel.webhook_avatar_url || undefined,
      embeds: discordEmbeds,
    };

    // Add components if provided (requires bot, not webhook)
    // Note: Components are not supported by webhooks, so we'll handle this differently
    // if needed in the future with bot integration

    // Send message to Discord
    const result = await sendDiscordMessage(payload);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send message" },
        { status: 500 }
      );
    }

    // Save message to database
    // Store first embed for backward compatibility, or store all embeds as JSON
    const embedDataForDb = discordEmbeds && discordEmbeds.length > 0 
      ? (discordEmbeds.length === 1 ? discordEmbeds[0] : { embeds: discordEmbeds })
      : null;

    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        channel_id,
        content: content || null,
        embed_data: embedDataForDb,
        discord_message_id: result.discordMessageId || null,
      })
      .select()
      .single();

    if (messageError) {
      return NextResponse.json({ error: messageError.message }, { status: 500 });
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const {
      channel_id,
      message_id,
      content,
      embed_data,
      embeds,
      components,
      webhook_username,
      webhook_avatar_url,
    } = body;

    if (!channel_id) {
      return NextResponse.json(
        { error: "channel_id is required" },
        { status: 400 }
      );
    }

    if (!message_id) {
      return NextResponse.json(
        { error: "message_id is required" },
        { status: 400 }
      );
    }

    // Get channel with webhook URL
    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .select("webhook_url, webhook_username, webhook_avatar_url")
      .eq("id", channel_id)
      .single();

    if (channelError || !channel || !channel.webhook_url) {
      return NextResponse.json(
        { error: "Channel not found or webhook URL not configured" },
        { status: 404 }
      );
    }

    // Prepare embed data - support both single embed_data (legacy) and embeds array
    let discordEmbeds: any[] | undefined;
    if (embeds && Array.isArray(embeds)) {
      discordEmbeds = embeds;
    } else if (embed_data) {
      discordEmbeds = [embed_data];
    }

    // Edit message via webhook
    const result = await editWebhookMessage(
      channel.webhook_url,
      message_id,
      {
        content: content || undefined,
        username: webhook_username || channel.webhook_username || undefined,
        avatarUrl: webhook_avatar_url || channel.webhook_avatar_url || undefined,
        embeds: discordEmbeds,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to edit message" },
        { status: 500 }
      );
    }

    // Update message in database if it exists
    const embedDataForDb = discordEmbeds && discordEmbeds.length > 0 
      ? (discordEmbeds.length === 1 ? discordEmbeds[0] : { embeds: discordEmbeds })
      : null;

    // Extract Discord message ID from message_id (might be a URL or just an ID)
    const extractedMessageId = extractMessageId(message_id);
    if (!extractedMessageId) {
      return NextResponse.json(
        { error: "Invalid message ID format" },
        { status: 400 }
      );
    }

    // Find and update the message in the database using channel_id and discord_message_id
    const { data: updatedMessage, error: updateError } = await supabase
      .from("messages")
      .update({
        content: content || null,
        embed_data: embedDataForDb,
      })
      .eq("channel_id", channel_id)
      .eq("discord_message_id", extractedMessageId)
      .select()
      .single();

    // If update fails, it might mean the message doesn't exist in the database yet
    // This is okay - the Discord message was successfully edited, so we'll still return success
    if (updateError && updateError.code !== "PGRST116") {
      // PGRST116 means no rows found, which is acceptable
      console.warn("Failed to update message in database:", updateError);
    }

    return NextResponse.json({ 
      success: true,
      message: "Message edited successfully",
      updatedMessage: updatedMessage || null
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


