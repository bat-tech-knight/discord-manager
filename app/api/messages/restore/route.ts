import { NextResponse } from "next/server";
import { extractMessageId } from "@/lib/discord/webhook";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const messageIdOrUrl = searchParams.get("message_id_or_url");
    const webhookUrl = searchParams.get("webhook_url");
    const channelId = searchParams.get("channel_id");

    if (!messageIdOrUrl) {
      return NextResponse.json(
        { error: "message_id_or_url is required" },
        { status: 400 }
      );
    }

    const extractedMessageId = extractMessageId(messageIdOrUrl);
    if (!extractedMessageId) {
      return NextResponse.json(
        { error: "Invalid message ID or URL format" },
        { status: 400 }
      );
    }

    let messageData: any;

    if (webhookUrl) {
      // Fetch from webhook
      const messageUrl = `${webhookUrl.replace(/\/$/, "")}/messages/${extractedMessageId}`;
      const response = await fetch(messageUrl, {
        method: "GET",
      });

      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json(
          { error: `Failed to fetch message: ${response.status} ${errorText}` },
          { status: response.status }
        );
      }

      messageData = await response.json();
    } else if (channelId) {
      // Fetch from channel using Discord Bot Token
      // Requires DISCORD_BOT_TOKEN environment variable
      const botToken = process.env.DISCORD_BOT_TOKEN;
      if (!botToken) {
        return NextResponse.json(
          { error: "Discord bot token not configured. Channel message restore requires a bot token." },
          { status: 500 }
        );
      }

      // Note: For channel messages, we need the Discord channel ID (snowflake)
      // The channelId here is our database UUID. In a full implementation,
      // you would query the channels table to get the Discord channel ID.
      // For now, we'll return an error asking for the Discord channel ID.
      // Alternatively, you could store the Discord channel ID in the channels table.
      return NextResponse.json(
        { error: "Channel message restore requires Discord channel ID. Please use webhook mode or ensure channel has Discord channel ID stored." },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        { error: "Either webhook_url or channel_id is required" },
        { status: 400 }
      );
    }

    // Parse and return message data in format expected by editor
    return NextResponse.json({
      content: messageData.content || "",
      embeds: messageData.embeds || [],
      components: messageData.components || [],
      username: messageData.author?.username || messageData.webhook_id ? messageData.author?.username : undefined,
      avatar_url: messageData.author?.avatar
        ? `https://cdn.discordapp.com/avatars/${messageData.author.id}/${messageData.author.avatar}.png`
        : undefined,
    });
  } catch (error) {
    console.error("Failed to restore message:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

