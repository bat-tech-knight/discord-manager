"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, Save, Send, Edit, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  discord_message_id: string | null;
  content: string | null;
  embed_data: any;
  sent_at: string;
}

interface PreviewSidebarProps {
  channelId: string | null;
  content: string;
  embedData: any;
  settingsData: any;
  onSend: () => void;
  onEditMessage: (message: Message) => void;
  onSaveTemplate: () => void;
  onLoadTemplate: () => void;
  refreshTrigger?: number;
}

export function PreviewSidebar({
  channelId,
  content,
  embedData,
  settingsData,
  onSend,
  onEditMessage,
  onSaveTemplate,
  onLoadTemplate,
  refreshTrigger,
}: PreviewSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  // Markdown renderer for content previews
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const { toHTML } = require("@/lib/discord/markdown") as typeof import(
    "@/lib/discord/markdown"
  );

  useEffect(() => {
    if (channelId) {
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [channelId, refreshTrigger]);

  const fetchMessages = async () => {
    if (!channelId) return;

    try {
      const response = await fetch(`/api/messages?channel_id=${channelId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;

    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setMessages(messages.filter((m) => m.id !== messageId));
      }
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return `Today at ${date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })}`;
    }
    return formatDistanceToNow(date, { addSuffix: true });
  };

  const renderEmbed = (embed: any) => {
    if (!embed) return null;

    let borderColor = "#5865F2";
    if (embed.color) {
      if (typeof embed.color === "string") {
        borderColor = embed.color.startsWith("#") ? embed.color : `#${embed.color}`;
      } else {
        borderColor = `#${embed.color.toString(16).padStart(6, "0")}`;
      }
    }

    return (
      <div
        className="rounded border-l-4 p-3 text-sm"
        style={{
          borderLeftColor: borderColor,
          backgroundColor: "#2F3136",
        }}
      >
        {embed.title && (
          <div className="font-semibold mb-1">{embed.title}</div>
        )}
        {embed.description && (
          <div
            className="text-muted-foreground mb-2 discord-markup"
            dangerouslySetInnerHTML={{ __html: toHTML(embed.description) }}
          />
        )}
        {embed.fields && embed.fields.length > 0 && (
          <div
            className={
              embed.fields.some((f: any) => f.inline)
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
                : "space-y-1"
            }
          >
            {embed.fields.map((field: any, idx: number) => (
              <div key={idx} className="text-xs">
                <span className="font-semibold block">{field.name}</span>
                <div
                  className="discord-markup"
                  dangerouslySetInnerHTML={{ __html: toHTML(field.value) }}
                />
              </div>
            ))}
          </div>
        )}
        {(embed.footer?.text || embed.footer?.icon_url || embed.timestamp) && (
          <div className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground">
            {embed.footer?.icon_url && (
              <img src={embed.footer.icon_url} alt="" className="w-4 h-4 rounded" />
            )}
            {embed.footer?.text && <span>{embed.footer.text}</span>}
            {embed.timestamp && (embed.footer?.text || embed.footer?.icon_url) && (
              <span>•</span>
            )}
            {embed.timestamp && (
              <span>{new Date(embed.timestamp).toLocaleString()}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-80 border-l border-border bg-background flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide">
            Preview
          </h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadTemplate}
            >
              <FileText className="h-4 w-4 mr-1" />
              Templates
            </Button>
            <Button variant="outline" size="sm" onClick={onSaveTemplate}>
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
            <Button size="sm" onClick={onSend} disabled={!channelId}>
              <Send className="h-4 w-4 mr-1" />
              Send
            </Button>
          </div>
        </div>

        <div className="rounded-lg border p-3 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
              {settingsData?.webhook_username?.charAt(0).toUpperCase() || "W"}
            </div>
            <div>
              <div className="text-sm font-semibold">
                {settingsData?.webhook_username || "Webhook"}
              </div>
              <div className="text-xs text-muted-foreground">
                Today at 12:00 PM
              </div>
            </div>
          </div>
          {content && (
            <div
              className="text-sm whitespace-pre-wrap discord-markup"
              dangerouslySetInnerHTML={{ __html: toHTML(content) }}
            />
          )}
          {embedData && renderEmbed(embedData)}
        </div>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide">
            Message History
          </h2>
          <span className="text-xs text-muted-foreground">
            {messages.length} {messages.length === 1 ? "message" : "messages"}
          </span>
        </div>

        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No messages yet
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="rounded-lg border p-3 bg-card">
                <div className="flex items-start justify-between mb-2">
                  <div className="text-xs text-muted-foreground">
                    {formatTime(message.sent_at)}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onEditMessage(message)}
                      className="p-1 hover:bg-accent rounded"
                      title="Edit"
                    >
                      <Edit className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteMessage(message.id)}
                      className="p-1 hover:bg-accent rounded text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                {message.content && (
                  <div className="text-sm whitespace-pre-wrap mb-2">
                    {message.content}
                  </div>
                )}
                {message.embed_data && renderEmbed(message.embed_data)}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

