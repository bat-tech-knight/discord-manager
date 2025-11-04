export interface DiscordWebhookPayload {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  footer?: {
    text: string;
    icon_url?: string;
  };
  thumbnail?: {
    url: string;
  };
  image?: {
    url: string;
  };
  timestamp?: string;
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface SendMessageOptions {
  webhookUrl: string;
  content?: string;
  username?: string;
  avatarUrl?: string;
  embeds?: DiscordEmbed[];
  threadId?: string;
}

/**
 * Validates a Discord webhook URL
 */
export function validateWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const isDiscordHost =
      hostname === "discord.com" ||
      hostname.endsWith(".discord.com") ||
      hostname === "discordapp.com" ||
      hostname.endsWith(".discordapp.com");

    return parsed.protocol === "https:" && isDiscordHost && parsed.pathname.startsWith("/api/webhooks/");
  } catch {
    return false;
  }
}

/**
 * Converts a hex color string to a decimal number for Discord embeds
 */
export function hexToDecimal(hex: string): number {
  // Remove # if present
  const cleanHex = hex.replace("#", "");
  return parseInt(cleanHex, 16);
}

/**
 * Extracts message ID from a Discord message URL or returns the ID if it's just an ID
 */
export function extractMessageId(messageIdOrUrl: string): string | null {
  if (!messageIdOrUrl) return null;
  
  // If it's just a numeric ID, return it
  if (/^\d+$/.test(messageIdOrUrl)) {
    return messageIdOrUrl;
  }
  
  // Try to extract from URL format: https://discord.com/channels/{guild}/{channel}/{message}
  try {
    const url = new URL(messageIdOrUrl);
    const parts = url.pathname.split("/");
    const messageId = parts[parts.length - 1];
    if (/^\d+$/.test(messageId)) {
      return messageId;
    }
  } catch {
    // Not a valid URL
  }
  
  return null;
}

/**
 * Builds a webhook message URL from webhook URL and message ID
 */
export function buildWebhookMessageUrl(webhookUrl: string, messageId: string): string {
  // Discord webhook message URL format: {webhook_url}/messages/{message_id}
  return `${webhookUrl.replace(/\/$/, "")}/messages/${messageId}`;
}

/**
 * Sends a message to Discord via webhook
 */
export async function sendDiscordMessage(
  options: SendMessageOptions
): Promise<{ success: boolean; message?: string; error?: string; discordMessageId?: string }> {
  const { webhookUrl, content, username, avatarUrl, embeds } = options;

  // Validate webhook URL
  if (!validateWebhookUrl(webhookUrl)) {
    return {
      success: false,
      error: "Invalid webhook URL format",
    };
  }

  // Build payload
  const payload: DiscordWebhookPayload = {};

  if (content) {
    payload.content = content;
  }

  if (username) {
    payload.username = username;
  }

  if (avatarUrl) {
    payload.avatar_url = avatarUrl;
  }

  if (embeds && embeds.length > 0) {
    payload.embeds = embeds;
  }

  // Validate that at least content or embeds are provided
  if (!payload.content && (!payload.embeds || payload.embeds.length === 0)) {
    return {
      success: false,
      error: "Message must have either content or at least one embed",
    };
  }

  try {
    // Build URL with wait=true to receive created message (and optional thread_id)
    const urlObj = new URL(webhookUrl);
    urlObj.searchParams.set("wait", "true");
    if (options.threadId) {
      urlObj.searchParams.set("thread_id", options.threadId);
    }
    const url = urlObj.toString();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorText = "";
      try {
        errorText = await response.text();
      } catch {
        errorText = response.statusText || `HTTP ${response.status}`;
      }
      return {
        success: false,
        error: `Discord API error: ${response.status} ${errorText}`,
      };
    }

    // Discord webhook returns the message object with an id field
    // Some responses may be empty, so handle that safely
    let discordMessageId: string | undefined;
    try {
      const contentType = response.headers.get("content-type");
      const text = await response.text();
      if (contentType?.includes("application/json") && text.trim()) {
        const messageData = JSON.parse(text);
        discordMessageId = messageData?.id || undefined;
      }
    } catch {
      // Response might be empty or not JSON, which is fine for webhooks
    }

    return {
      success: true,
      message: "Message sent successfully",
      discordMessageId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Edits a webhook message using PATCH request
 */
export async function editWebhookMessage(
  webhookUrl: string,
  messageId: string,
  options: {
    content?: string;
    embeds?: DiscordEmbed[];
    username?: string;
    avatarUrl?: string;
  }
): Promise<{ success: boolean; message?: string; error?: string }> {
  // Validate webhook URL
  if (!validateWebhookUrl(webhookUrl)) {
    return {
      success: false,
      error: "Invalid webhook URL format",
    };
  }

  // Extract message ID if URL provided
  const extractedId = extractMessageId(messageId);
  if (!extractedId) {
    return {
      success: false,
      error: "Invalid message ID or URL",
    };
  }

  // Build message URL
  const messageUrl = buildWebhookMessageUrl(webhookUrl, extractedId);

  // Build payload
  const payload: DiscordWebhookPayload = {};

  if (options.content !== undefined) {
    payload.content = options.content;
  }

  if (options.username) {
    payload.username = options.username;
  }

  if (options.avatarUrl) {
    payload.avatar_url = options.avatarUrl;
  }

  if (options.embeds && options.embeds.length > 0) {
    payload.embeds = options.embeds;
  }

  // Validate that at least content or embeds are provided
  if (options.content === undefined && (!payload.embeds || payload.embeds.length === 0)) {
    return {
      success: false,
      error: "Message must have either content or at least one embed",
    };
  }

  try {
    const response = await fetch(messageUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorText = "";
      try {
        errorText = await response.text();
      } catch {
        errorText = response.statusText || `HTTP ${response.status}`;
      }
      return {
        success: false,
        error: `Discord API error: ${response.status} ${errorText}`,
      };
    }

    return {
      success: true,
      message: "Message edited successfully",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}


