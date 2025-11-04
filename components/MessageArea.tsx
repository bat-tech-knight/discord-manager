"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Send,
  Plus,
  Smile,
  FileText,
  Save,
  Edit,
  Trash2,
  Hash,
  Settings,
  Layout,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  discord_message_id: string | null;
  content: string | null;
  embed_data: any;
  sent_at: string;
}

interface EmbedData {
  title?: string;
  description?: string;
  color?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

interface SettingsData {
  webhook_username?: string;
  webhook_avatar_url?: string;
}

interface MessageAreaProps {
  channelId: string | null;
  channelName?: string;
  content: string;
  embedData: EmbedData | null;
  settingsData: SettingsData | null;
  onContentChange: (content: string) => void;
  onEmbedDataChange: (data: EmbedData | null) => void;
  onSettingsDataChange: (data: SettingsData | null) => void;
  onSend: () => void;
  onEditMessage: (message: Message) => void;
  onSaveTemplate: () => void;
  onLoadTemplate: () => void;
  refreshTrigger?: number;
}

export function MessageArea({
  channelId,
  channelName,
  content,
  embedData,
  settingsData,
  onContentChange,
  onEmbedDataChange,
  onSettingsDataChange,
  onSend,
  onEditMessage,
  onSaveTemplate,
  onLoadTemplate,
  refreshTrigger,
}: MessageAreaProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [embedFields, setEmbedFields] = useState<
    Array<{ name: string; value: string; inline?: boolean }>
  >(embedData?.fields || []);
  const [showComposerTabs, setShowComposerTabs] = useState(false);

  useEffect(() => {
    if (channelId) {
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [channelId, refreshTrigger]);

  useEffect(() => {
    if (embedData?.fields) {
      setEmbedFields(embedData.fields);
    }
  }, [embedData]);

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
        borderColor = embed.color.startsWith("#")
          ? embed.color
          : `#${embed.color}`;
      } else {
        borderColor = `#${embed.color.toString(16).padStart(6, "0")}`;
      }
    }

    return (
      <div
        className="rounded-lg border-l-4 p-3 text-sm mt-2"
        style={{
          borderLeftColor: borderColor,
          backgroundColor: "rgba(0, 0, 0, 0.2)",
        }}
      >
        {embed.title && (
          <div className="font-semibold mb-1 text-white">{embed.title}</div>
        )}
        {embed.description && (
          <div className="text-discord-text-secondary mb-2">
            {embed.description}
          </div>
        )}
        {embed.fields && embed.fields.length > 0 && (
          <div className="space-y-1">
            {embed.fields.map((field: any, idx: number) => (
              <div key={idx} className="text-xs">
                <span className="font-semibold text-white">{field.name}:</span>{" "}
                <span className="text-discord-text-secondary">{field.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const updateEmbedData = (updates: Partial<EmbedData>) => {
    onEmbedDataChange({
      ...embedData,
      ...updates,
    } as EmbedData);
  };

  const addEmbedField = () => {
    const newFields = [...embedFields, { name: "", value: "" }];
    setEmbedFields(newFields);
    updateEmbedData({ fields: newFields });
  };

  const updateEmbedField = (
    index: number,
    updates: Partial<NonNullable<EmbedData["fields"]>[0]>
  ) => {
    const newFields = [...embedFields];
    newFields[index] = { ...newFields[index], ...updates };
    setEmbedFields(newFields);
    updateEmbedData({ fields: newFields });
  };

  const removeEmbedField = (index: number) => {
    const newFields = embedFields.filter((_, i) => i !== index);
    setEmbedFields(newFields);
    updateEmbedData({ fields: newFields });
  };

  if (!channelId) {
    return (
      <div className="flex-1 bg-discord-message-area flex items-center justify-center text-discord-text-muted">
        <div className="text-center">
          <Hash className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Select a channel to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-discord-message-area overflow-hidden">
      {/* Channel Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-discord-hover shadow-sm">
        <div className="flex items-center gap-2">
          <Hash className="h-5 w-5 text-discord-text-muted" />
          <h2 className="font-semibold text-base text-white">
            {channelName || "channel"}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => router.push(`/protected/editor${channelId ? `?channel_id=${channelId}` : ""}`)}
            className="p-1.5 hover:bg-discord-hover rounded text-discord-text-muted hover:text-discord-text-primary transition-colors"
            title="Embed Editor"
          >
            <Layout className="h-5 w-5" />
          </button>
          <button
            onClick={onLoadTemplate}
            className="p-1.5 hover:bg-discord-hover rounded text-discord-text-muted hover:text-discord-text-primary transition-colors"
            title="Templates"
          >
            <FileText className="h-5 w-5" />
          </button>
          <button
            onClick={onSaveTemplate}
            className="p-1.5 hover:bg-discord-hover rounded text-discord-text-muted hover:text-discord-text-primary transition-colors"
            title="Save Template"
          >
            <Save className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowComposerTabs(!showComposerTabs)}
            className="p-1.5 hover:bg-discord-hover rounded text-discord-text-muted hover:text-discord-text-primary transition-colors"
            title="Message Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-discord-text-muted">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className="group hover:bg-discord-hover/30 rounded px-2 py-1 -mx-2 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-discord-blurple flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                  {settingsData?.webhook_username?.charAt(0).toUpperCase() ||
                    "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-semibold text-white text-sm">
                      {settingsData?.webhook_username || "User"}
                    </span>
                    <span className="text-discord-text-muted text-xs">
                      {formatTime(message.sent_at)}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                      <button
                        onClick={() => onEditMessage(message)}
                        className="p-1 hover:bg-discord-hover rounded text-discord-text-muted hover:text-white transition-colors"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(message.id)}
                        className="p-1 hover:bg-discord-hover rounded text-red-400 hover:text-red-300 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {message.content && (
                    <div
                      className="text-discord-text-primary text-sm whitespace-pre-wrap mb-2 discord-markup"
                      dangerouslySetInnerHTML={{
                        __html: (require("@/lib/discord/markdown") as typeof import("@/lib/discord/markdown")).toHTML(
                          message.content
                        ),
                      }}
                    />
                  )}
                  {message.embed_data && (
                    Array.isArray(message.embed_data.embeds)
                      ? (
                        <div className="space-y-2">
                          {message.embed_data.embeds.map((e: any, idx: number) => (
                            <div key={idx}>{renderEmbed(e)}</div>
                          ))}
                        </div>
                      )
                      : renderEmbed(message.embed_data)
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Message Input Area */}
      <div className="px-4 pb-4">
        {showComposerTabs && (
          <div className="mb-2 border border-discord-hover rounded-lg p-3 bg-discord-channel-sidebar">
            <Tabs defaultValue="embed" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-3">
                <TabsTrigger value="embed">Embed</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="embed" className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm text-discord-text-secondary">
                    Title
                  </Label>
                  <Input
                    value={embedData?.title || ""}
                    onChange={(e) => updateEmbedData({ title: e.target.value })}
                    placeholder="Embed title"
                    className="bg-discord-hover border-discord-hover text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-discord-text-secondary">
                    Description
                  </Label>
                  <Textarea
                    value={embedData?.description || ""}
                    onChange={(e) =>
                      updateEmbedData({ description: e.target.value })
                    }
                    placeholder="Embed description"
                    className="bg-discord-hover border-discord-hover text-white min-h-[80px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-discord-text-secondary">
                    Color
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={embedData?.color || "#5865F2"}
                      onChange={(e) =>
                        updateEmbedData({ color: e.target.value })
                      }
                      className="w-16 h-9"
                    />
                    <Input
                      value={embedData?.color || ""}
                      onChange={(e) =>
                        updateEmbedData({ color: e.target.value })
                      }
                      placeholder="#5865F2"
                      className="bg-discord-hover border-discord-hover text-white"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-discord-text-secondary">
                      Fields
                    </Label>
                    <button
                      onClick={addEmbedField}
                      className="text-xs text-discord-blurple hover:underline"
                    >
                      + Add Field
                    </button>
                  </div>
                  <div className="space-y-2">
                    {embedFields.map((field, index) => (
                      <div
                        key={index}
                        className="p-2 border border-discord-hover rounded space-y-2 bg-discord-hover/50"
                      >
                        <Input
                          placeholder="Field name"
                          value={field.name}
                          onChange={(e) =>
                            updateEmbedField(index, { name: e.target.value })
                          }
                          className="bg-discord-hover border-discord-hover text-white text-sm"
                        />
                        <Textarea
                          placeholder="Field value"
                          value={field.value}
                          onChange={(e) =>
                            updateEmbedField(index, { value: e.target.value })
                          }
                          className="bg-discord-hover border-discord-hover text-white text-sm min-h-[50px]"
                        />
                        <div className="flex items-center justify-between">
                          <label className="text-xs flex items-center gap-2 text-discord-text-secondary">
                            <input
                              type="checkbox"
                              checked={field.inline || false}
                              onChange={(e) =>
                                updateEmbedField(index, {
                                  inline: e.target.checked,
                                })
                              }
                            />
                            Inline
                          </label>
                          <button
                            onClick={() => removeEmbedField(index)}
                            className="text-xs text-red-400 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="settings" className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm text-discord-text-secondary">
                    Webhook Username
                  </Label>
                  <Input
                    value={settingsData?.webhook_username || ""}
                    onChange={(e) =>
                      onSettingsDataChange({
                        ...settingsData,
                        webhook_username: e.target.value,
                      })
                    }
                    placeholder="Override webhook username"
                    className="bg-discord-hover border-discord-hover text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-discord-text-secondary">
                    Webhook Avatar URL
                  </Label>
                  <Input
                    value={settingsData?.webhook_avatar_url || ""}
                    onChange={(e) =>
                      onSettingsDataChange({
                        ...settingsData,
                        webhook_avatar_url: e.target.value,
                      })
                    }
                    placeholder="https://..."
                    type="url"
                    className="bg-discord-hover border-discord-hover text-white"
                  />
                </div>
              </TabsContent>
              <TabsContent value="preview" className="space-y-3">
                <div className="rounded-lg border border-discord-hover p-3 bg-discord-channel-sidebar">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-discord-blurple flex items-center justify-center text-white text-xs font-semibold">
                      {settingsData?.webhook_username?.charAt(0).toUpperCase() ||
                        "W"}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {settingsData?.webhook_username || "Webhook"}
                      </div>
                      <div className="text-xs text-discord-text-muted">
                        Today at 12:00 PM
                      </div>
                    </div>
                  </div>
                  {content && (
                    <div className="text-sm text-discord-text-primary whitespace-pre-wrap mb-2">
                      {content}
                    </div>
                  )}
                  {embedData && renderEmbed(embedData)}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 bg-discord-channel-sidebar rounded-lg border border-discord-hover p-1 flex items-end gap-1">
            <button className="p-2 hover:bg-discord-hover rounded text-discord-text-muted hover:text-discord-text-primary transition-colors">
              <Plus className="h-5 w-5" />
            </button>
            <Textarea
              placeholder={`Message #${channelName || "channel"}`}
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              className="flex-1 bg-transparent border-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 text-white placeholder:text-discord-text-muted min-h-[44px] max-h-[200px]"
              rows={1}
            />
            <button className="p-2 hover:bg-discord-hover rounded text-discord-text-muted hover:text-discord-text-primary transition-colors">
              <Smile className="h-5 w-5" />
            </button>
          </div>
          <Button
            onClick={onSend}
            className="bg-discord-blurple hover:bg-discord-blurple/90 text-white"
            disabled={!content && !embedData}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

