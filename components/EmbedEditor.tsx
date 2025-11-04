"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Eye,
  Link as LinkIcon,
  Smile,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Send,
  Loader2,
  RotateCcw,
  RotateCw,
  Trash2,
  Download,
  Link2,
  Copy,
  Save,
} from "lucide-react";
import { EmbedEditorPreview } from "@/components/EmbedEditorPreview";
import { EmbedForm } from "@/components/EmbedForm";
import { AttachmentManager } from "@/components/AttachmentManager";
import { ComponentManager } from "@/components/ComponentManager";
import { EditorSidebar } from "@/components/EditorSidebar";
import { JsonEditorModal } from "@/components/modals/JsonEditorModal";
import { SaveTemplateModal } from "@/components/modals/SaveTemplateModal";
import { extractMessageId } from "@/lib/discord/webhook";

interface Embed {
  title?: string;
  description?: string;
  color?: string;
  url?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  author?: { name?: string; icon_url?: string; url?: string };
  footer?: { text?: string; icon_url?: string };
  thumbnail?: { url: string };
  image?: { url: string };
  timestamp?: string;
}

interface Component {
  type: number;
  components: any[];
}

interface Workspace {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface Channel {
  id: string;
  name: string;
  workspace_id: string;
}

export function EmbedEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channelId = searchParams.get("channel_id");

  // Mode selection (webhook or channel)
  const [mode, setMode] = useState<"webhook" | "channel">("webhook");

  // Webhook mode state
  const [webhookUrl, setWebhookUrl] = useState("");
  const [threadId, setThreadId] = useState("");
  const [messageIdOrUrl, setMessageIdOrUrl] = useState("");

  // Channel mode state
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [channelMessageIdOrUrl, setChannelMessageIdOrUrl] = useState<string>("");

  const [content, setContent] = useState("");
  const [embeds, setEmbeds] = useState<Embed[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [webhookUsername, setWebhookUsername] = useState("");
  const [webhookAvatarUrl, setWebhookAvatarUrl] = useState("");

  // Message format toggle (Embeds V1 vs Components V2)
  const [messageFormat, setMessageFormat] = useState<"embeds" | "components">("embeds");

  // Collapsible sections
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [embedsOpen, setEmbedsOpen] = useState(true);
  const [componentsOpen, setComponentsOpen] = useState(false);

  // Embed carousel state
  const [currentEmbedIndex, setCurrentEmbedIndex] = useState(0);

  // JSON Modal
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);

  // Undo/Redo History
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Loading states
  const [isRestoring, setIsRestoring] = useState(false);

  // Character limit
  const MAX_CONTENT_LENGTH = 2000;
  const contentLength = content.length;

  // Fetch workspaces on mount
  useEffect(() => {
    fetchWorkspaces();
  }, []);

  // Fetch channels when workspace changes
  useEffect(() => {
    if (selectedWorkspaceId) {
      fetchChannels(selectedWorkspaceId);
    } else {
      setChannels([]);
      setSelectedChannelId("");
    }
  }, [selectedWorkspaceId]);

  // Handle URL params for edit button integration
  useEffect(() => {
    const webhookUrlParam = searchParams.get("webhook_url");
    const threadIdParam = searchParams.get("thread_id");
    const messageIdParam = searchParams.get("message_id");
    const webhookUsernameParam = searchParams.get("webhook_username");
    const webhookAvatarUrlParam = searchParams.get("webhook_avatar_url");
    const channelMessageIdParam = searchParams.get("channel_message_id");

    if (webhookUrlParam) {
      setMode("webhook");
      setWebhookUrl(webhookUrlParam);
      if (threadIdParam) setThreadId(threadIdParam);
      if (webhookUsernameParam) setWebhookUsername(webhookUsernameParam);
      if (webhookAvatarUrlParam) setWebhookAvatarUrl(webhookAvatarUrlParam);
      if (messageIdParam) {
        setMessageIdOrUrl(messageIdParam);
      } else if (channelMessageIdParam) {
        // If only channel message id is present, use it to prefill webhook edit as well
        setMessageIdOrUrl(channelMessageIdParam);
      }
    } else if (channelId) {
      setMode("channel");
      setSelectedChannelId(channelId);
      // Try to find and set the workspace/channel
      // This would require additional API call to get channel details
      // For now, we'll let user select manually
    }

    // Handle message_id for channel mode
    if (channelMessageIdParam) {
      setChannelMessageIdOrUrl(channelMessageIdParam);
    }
  }, [channelId, searchParams]);

  // Load message from DB when db_message_id is provided
  useEffect(() => {
    const dbMessageId = searchParams.get("db_message_id");
    const wsId = searchParams.get("workspace_id");
    if (wsId) {
      setSelectedWorkspaceId(wsId);
    }
    if (!dbMessageId) return;
    (async () => {
      try {
        const res = await fetch(`/api/messages?id=${dbMessageId}`);
        if (!res.ok) return;
        const data = await res.json();
        const m = data.message;
        if (!m) return;
        // Set editor state from stored message
        setContent(m.content || "");
        if (m.embed_data) {
          if (m.embed_data.embeds && Array.isArray(m.embed_data.embeds)) {
            setEmbeds(m.embed_data.embeds);
          } else {
            setEmbeds([m.embed_data]);
          }
        } else {
          setEmbeds([]);
        }
        // If saved discord_message_id, keep it in channel edit field
        if (!channelMessageIdOrUrl && m.discord_message_id) {
          setChannelMessageIdOrUrl(m.discord_message_id);
        }
      } catch (e) {
        console.error("Failed to load message from DB:", e);
      }
    })();
  }, [searchParams]);

  // Load template when template_id is provided
  useEffect(() => {
    const templateId = searchParams.get("template_id");
    if (!templateId) return;
    (async () => {
      try {
        const res = await fetch(`/api/templates?id=${templateId}`);
        if (!res.ok) return;
        const data = await res.json();
        const template = data.template;
        if (!template || !template.message_data) return;

        const md = template.message_data;
        
        // Populate editor from message_data
        if (md.content !== undefined) setContent(md.content || "");
        
        if (md.embeds) {
          // Convert Discord embeds to editor format
          const editorEmbeds = md.embeds.map((embed: any) => ({
            title: embed.title,
            description: embed.description,
            color: embed.color ? `#${embed.color.toString(16).padStart(6, "0")}` : undefined,
            fields: embed.fields || [],
            author: embed.author,
            footer: embed.footer,
            thumbnail: embed.thumbnail,
            image: embed.image,
            timestamp: embed.timestamp,
          }));
          setEmbeds(editorEmbeds);
        } else {
          setEmbeds([]);
        }
        
        if (md.components) {
          setComponents(md.components);
        }
        
        if (md.username) {
          setWebhookUsername(md.username);
        }
        
        if (md.avatar_url) {
          setWebhookAvatarUrl(md.avatar_url);
        }

        // Push to history after a delay to ensure all state is set
        setTimeout(() => pushToHistory(), 100);
      } catch (e) {
        console.error("Failed to load template:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch("/api/workspaces");
      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data.workspaces || []);
      }
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
    }
  };

  const fetchChannels = async (workspaceId: string) => {
    try {
      const response = await fetch(`/api/channels?workspace_id=${workspaceId}`);
      if (response.ok) {
        const data = await response.json();
        setChannels(data.channels || []);
      }
    } catch (error) {
      console.error("Failed to fetch channels:", error);
    }
  };

  // Formatting functions
  const insertFormatting = (before: string, after: string = before) => {
    const textarea = document.querySelector(
      'textarea[placeholder*="message"]'
    ) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newText =
      content.substring(0, start) +
      `${before}${selectedText || "text"}${after}` +
      content.substring(end);

    setContent(newText);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + (selectedText || "text").length
      );
    }, 0);
  };

  const handleBold = () => insertFormatting("**");
  const handleItalic = () => insertFormatting("_");
  const handleUnderline = () => insertFormatting("__");
  const handleStrikethrough = () => insertFormatting("~~");
  const handleSpoiler = () => insertFormatting("||");
  const handleLink = () => {
    const textarea = document.querySelector(
      'textarea[placeholder*="message"]'
    ) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end) || "text";
    const linkText = `[${selectedText}](https://example.com)`;
    const newText =
      content.substring(0, start) + linkText + content.substring(end);

    setContent(newText);

    setTimeout(() => {
      textarea.focus();
      const linkStart = start + linkText.indexOf("https://");
      textarea.setSelectionRange(linkStart, linkStart + 13);
    }, 0);
  };

  const addEmbed = () => {
    setEmbeds([...embeds, {}]);
  };

  const updateEmbed = (index: number, updates: Partial<Embed>) => {
    const newEmbeds = [...embeds];
    newEmbeds[index] = { ...newEmbeds[index], ...updates };
    setEmbeds(newEmbeds);
  };

  const removeEmbed = (index: number) => {
    setEmbeds(embeds.filter((_, i) => i !== index));
  };

  const clearEmbeds = () => {
    if (embeds.length > 0 && confirm("Clear all embeds?")) {
      setEmbeds([]);
    }
  };

  // Get current message state as JSON snapshot
  const getMessageSnapshot = useCallback(() => {
    return {
      content,
      embeds,
      components,
      attachments: attachments.map((f) => ({ name: f.name, size: f.size, type: f.type })),
      webhookUsername,
      webhookAvatarUrl,
    };
  }, [content, embeds, components, attachments, webhookUsername, webhookAvatarUrl]);

  // Push current state to history (debounced)
  const pushToHistory = useCallback(() => {
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
    }

    historyTimeoutRef.current = setTimeout(() => {
      const snapshot = getMessageSnapshot();
      setHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(snapshot);
        // Limit history to 50 entries
        if (newHistory.length > 50) {
          newHistory.shift();
        } else {
          setHistoryIndex(newHistory.length - 1);
        }
        return newHistory;
      });
    }, 500); // Debounce by 500ms
  }, [getMessageSnapshot, historyIndex]);

  // Undo handler
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevSnapshot = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      restoreFromSnapshot(prevSnapshot);
    }
  };

  // Redo handler
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextSnapshot = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      restoreFromSnapshot(nextSnapshot);
    }
  };

  // Restore state from snapshot
  const restoreFromSnapshot = (snapshot: any) => {
    setContent(snapshot.content || "");
    setEmbeds(snapshot.embeds || []);
    setComponents(snapshot.components || []);
    setWebhookUsername(snapshot.webhookUsername || "");
    setWebhookAvatarUrl(snapshot.webhookAvatarUrl || "");
    // Note: Attachments can't be fully restored, so we skip them
  };

  // Restore message from Discord
  const handleRestoreMessage = async () => {
    const currentMessageIdOrUrl = mode === "webhook" ? messageIdOrUrl : channelMessageIdOrUrl;
    if (!currentMessageIdOrUrl) {
      alert("Please enter a Message ID or URL");
      return;
    }

    setIsRestoring(true);
    try {
      const params = new URLSearchParams();
      params.set("message_id_or_url", currentMessageIdOrUrl);
      
      if (mode === "webhook") {
        if (!webhookUrl) {
          alert("Please enter a webhook URL first");
          setIsRestoring(false);
          return;
        }
        params.set("webhook_url", webhookUrl);
      } else {
        if (!selectedChannelId) {
          alert("Please select a channel first");
          setIsRestoring(false);
          return;
        }
        params.set("channel_id", selectedChannelId);
      }

      const response = await fetch(`/api/messages/restore?${params.toString()}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to restore message");
      }

      const data = await response.json();
      
      // Populate editor with restored message data
      if (data.content !== undefined) setContent(data.content || "");
      if (data.embeds) {
        // Convert Discord embeds to editor format
        const editorEmbeds = data.embeds.map((embed: any) => ({
          title: embed.title,
          description: embed.description,
          color: embed.color ? `#${embed.color.toString(16).padStart(6, "0")}` : undefined,
          fields: embed.fields || [],
          author: embed.author,
          footer: embed.footer,
          thumbnail: embed.thumbnail,
          image: embed.image,
          timestamp: embed.timestamp,
        }));
        setEmbeds(editorEmbeds);
      }
      if (data.components) {
        setComponents(data.components);
      }
      if (data.username) {
        setWebhookUsername(data.username);
      }
      if (data.avatar_url) {
        setWebhookAvatarUrl(data.avatar_url);
      }

      // Push to history
      pushToHistory();
      
      alert("Message restored successfully!");
    } catch (error) {
      console.error("Failed to restore message:", error);
      alert(`Failed to restore message: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsRestoring(false);
    }
  };

  // Export JSON handler
  const handleExportJson = () => {
    setIsJsonModalOpen(true);
  };

  // Build Discord message payload
  const buildDiscordMessagePayload = () => {
    const discordEmbeds = embeds
      .filter((e) => e.title || e.description || e.fields?.length)
      .map((embed) => {
        const discordEmbed: any = {};

        if (embed.title) discordEmbed.title = embed.title;
        if (embed.description) discordEmbed.description = embed.description;
        if (embed.color) {
          discordEmbed.color =
            typeof embed.color === "string"
              ? parseInt(embed.color.replace("#", ""), 16)
              : embed.color;
        }
        if (embed.fields && embed.fields.length > 0) {
          discordEmbed.fields = embed.fields.filter(
            (f) => f.name && f.value
          );
        }
        if (embed.author) discordEmbed.author = embed.author;
        if (embed.footer) discordEmbed.footer = embed.footer;
        if (embed.thumbnail) discordEmbed.thumbnail = embed.thumbnail;
        if (embed.image) discordEmbed.image = embed.image;
        if (embed.timestamp) discordEmbed.timestamp = embed.timestamp;

        return discordEmbed;
      });

    return {
      content: content || "",
      tts: false,
      embeds: discordEmbeds,
      components: components.length > 0 ? components : [],
      actions: {},
      flags: 0,
      username: webhookUsername || "",
      avatar_url: webhookAvatarUrl || "",
    };
  };

  // Save JSON from modal
  const handleSaveJson = (jsonData: any) => {
    try {
      // Parse and update editor state
      if (jsonData.content !== undefined) setContent(jsonData.content || "");
      if (jsonData.embeds) {
        const editorEmbeds = jsonData.embeds.map((embed: any) => ({
          title: embed.title,
          description: embed.description,
          color: embed.color ? `#${embed.color.toString(16).padStart(6, "0")}` : undefined,
          fields: embed.fields || [],
          author: embed.author,
          footer: embed.footer,
          thumbnail: embed.thumbnail,
          image: embed.image,
          timestamp: embed.timestamp,
        }));
        setEmbeds(editorEmbeds);
      }
      if (jsonData.components) {
        setComponents(jsonData.components);
      }
      if (jsonData.username) {
        setWebhookUsername(jsonData.username);
      }
      if (jsonData.avatar_url) {
        setWebhookAvatarUrl(jsonData.avatar_url);
      }

      pushToHistory();
    } catch (error) {
      console.error("Failed to parse JSON data:", error);
      alert("Failed to parse JSON data");
    }
  };

  // Share handler
  const handleShare = async () => {
    try {
      const messageData = buildDiscordMessagePayload();
      const response = await fetch("/api/messages/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_data: messageData }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create shareable link");
      }

      const data = await response.json();
      const shareUrl = `${window.location.origin}/protected/editor?shared_id=${data.id}`;
      
      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      alert(`Shareable link copied to clipboard!\n${shareUrl}`);
    } catch (error) {
      console.error("Failed to share message:", error);
      alert(`Failed to share message: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // Delete/Clear handler
  const handleDelete = () => {
    if (!confirm("Are you sure you want to clear all editor fields?")) {
      return;
    }

    setContent("");
    setEmbeds([]);
    setComponents([]);
    setAttachments([]);
    setWebhookUsername("");
    setWebhookAvatarUrl("");
    setMessageIdOrUrl("");
    setChannelMessageIdOrUrl("");

    pushToHistory();
  };

  // Track changes for undo/redo history
  useEffect(() => {
    // Push to history when content, embeds, or components change
    // Skip initial mount and only track actual changes
    if (history.length > 0 || content || embeds.length > 0 || components.length > 0) {
      pushToHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, embeds, components]);

  // Initialize history with current state
  useEffect(() => {
    if (history.length === 0) {
      const initialSnapshot = getMessageSnapshot();
      setHistory([initialSnapshot]);
      setHistoryIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle shared_id query param on load
  useEffect(() => {
    const sharedId = searchParams.get("shared_id");
    if (sharedId) {
      fetch(`/api/messages/share/${sharedId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.message_data) {
            handleSaveJson(data.message_data);
          }
        })
        .catch((error) => {
          console.error("Failed to load shared message:", error);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSend = async () => {
    if (isSending) return;
    setIsSending(true);
    // Convert embeds to Discord format
    const discordEmbeds = embeds
      .filter((e) => e.title || e.description || e.fields?.length)
      .map((embed) => {
        const discordEmbed: any = {};

        if (embed.title) discordEmbed.title = embed.title;
        if (embed.description) discordEmbed.description = embed.description;
        if (embed.color) {
          discordEmbed.color =
            typeof embed.color === "string"
              ? parseInt(embed.color.replace("#", ""), 16)
              : embed.color;
        }
        if (embed.fields && embed.fields.length > 0) {
          discordEmbed.fields = embed.fields.filter(
            (f) => f.name && f.value
          );
        }
        if (embed.author) discordEmbed.author = embed.author;
        if (embed.footer) discordEmbed.footer = embed.footer;
        if (embed.thumbnail) discordEmbed.thumbnail = embed.thumbnail;
        if (embed.image) discordEmbed.image = embed.image;
        if (embed.timestamp) discordEmbed.timestamp = embed.timestamp;

        return discordEmbed;
      });

    try {
      if (mode === "webhook") {
        // Webhook mode
        if (!webhookUrl) {
          toast.error("Please enter a webhook URL");
          return;
        }

        const payload: any = {
          webhook_url: webhookUrl,
          content: content || null,
          embeds: discordEmbeds.length > 0 ? discordEmbeds : null,
          username: webhookUsername || undefined,
          avatar_url: webhookAvatarUrl || undefined,
        };

        if (threadId) {
          payload.thread_id = threadId;
        }

        if (messageIdOrUrl) {
          payload.message_id = messageIdOrUrl;
        }

        const response = await fetch("/api/webhooks", {
          method: messageIdOrUrl ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          toast.success(messageIdOrUrl ? "Message edited successfully!" : "Message sent successfully!");
          // Keep form state - don't clear after send/edit
        } else {
          let errorMessage = `Failed to ${messageIdOrUrl ? "edit" : "send"} message`;
          try {
            const errorText = await response.text();
            if (errorText) {
              try {
                const error = JSON.parse(errorText);
                errorMessage = error.error || errorMessage;
              } catch {
                errorMessage = errorText || errorMessage;
              }
            }
          } catch {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          toast.error(errorMessage);
        }
      } else {
        // Channel mode
        if (!selectedChannelId) {
          toast.error("Please select a channel first");
          return;
        }

        const payload: any = {
          channel_id: selectedChannelId,
          content: content || null,
          embeds: discordEmbeds.length > 0 ? discordEmbeds : null,
        };

        if (components.length > 0) {
          payload.components = components;
        }

        if (channelMessageIdOrUrl) {
          payload.message_id = channelMessageIdOrUrl;
        }

        const response = await fetch("/api/messages", {
          method: channelMessageIdOrUrl ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          toast.success(channelMessageIdOrUrl ? "Message edited successfully!" : "Message sent successfully!");
          // Keep form state - don't clear after send/edit
          router.push(`/protected?channel_id=${selectedChannelId}`);
        } else {
          let errorMessage = `Failed to ${channelMessageIdOrUrl ? "edit" : "send"} message`;
          try {
            const errorText = await response.text();
            if (errorText) {
              try {
                const error = JSON.parse(errorText);
                errorMessage = error.error || errorMessage;
              } catch {
                errorMessage = errorText || errorMessage;
              }
            }
          } catch {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          toast.error(errorMessage);
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message. Check console for details.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-screen flex bg-discord-message-area overflow-hidden">
      {/* Sidebar */}
      <EditorSidebar />

      {/* Left Panel - Editor */}
      <div className="flex-1 flex flex-col border-r border-discord-hover overflow-hidden">
        {/* Header */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-discord-hover bg-discord-channel-sidebar">
          <h1 className="font-semibold text-white">Embed Generator</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSaveTemplateModalOpen(true)}
              className="text-discord-text-muted hover:text-white"
              title="Save as Template"
            >
              <Save className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/protected")}
              className="text-discord-text-muted hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Mode Selection Tabs */}
          <Tabs value={mode} onValueChange={(value) => setMode(value as "webhook" | "channel")}>
            <TabsList className="w-fit mb-4 bg-discord-hover p-1">
              <TabsTrigger 
                value="webhook"
                className="text-discord-text-muted data-[state=active]:bg-discord-blurple dark:data-[state=active]:bg-discord-blurple data-[state=active]:hover:bg-discord-blurple/90 data-[state=active]:text-white dark:data-[state=active]:text-white data-[state=inactive]:bg-transparent"
              >
                Webhook
              </TabsTrigger>
              <TabsTrigger 
                value="channel"
                className="text-discord-text-muted data-[state=active]:bg-discord-blurple dark:data-[state=active]:bg-discord-blurple data-[state=active]:hover:bg-discord-blurple/90 data-[state=active]:text-white dark:data-[state=active]:text-white data-[state=inactive]:bg-transparent"
              >
                Channel
              </TabsTrigger>
            </TabsList>

            <TabsContent value="webhook" className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-discord-text-secondary uppercase">
                  Webhook URL
                </Label>
                <Input
                  type="url"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="bg-discord-channel-sidebar border-discord-hover text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-discord-text-secondary uppercase">
                  Thread ID
                </Label>
                <Input
                  placeholder="Optional: Thread ID for forum posts"
                  value={threadId}
                  onChange={(e) => setThreadId(e.target.value)}
                  className="bg-discord-channel-sidebar border-discord-hover text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-discord-text-secondary uppercase">
                  Message ID or URL
                </Label>
                <Input
                  placeholder="Optional: Message ID or URL for editing"
                  value={messageIdOrUrl}
                  onChange={(e) => setMessageIdOrUrl(e.target.value)}
                  className="bg-discord-channel-sidebar border-discord-hover text-white"
                />
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2 justify-end">
                <Button
                  onClick={handleRestoreMessage}
                  disabled={isRestoring || !messageIdOrUrl}
                  variant="outline"
                  className="border-discord-hover text-discord-text-secondary hover:text-white hover:bg-discord-hover"
                >
                  {isRestoring ? "Restoring..." : "Restore Message"}
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={
                    !webhookUrl ||
                    (!content && embeds.length === 0) ||
                    isSending
                  }
                  className="bg-discord-blurple hover:bg-discord-blurple/90 text-white"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      {messageIdOrUrl ? "Edit Message" : "Send Message"}
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="channel" className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-discord-text-secondary uppercase">
                  Server/Workspace
                </Label>
                <select
                  value={selectedWorkspaceId}
                  onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                  className="w-full px-3 py-2 bg-discord-channel-sidebar border border-discord-hover rounded-md text-white focus:outline-none focus:ring-2 focus:ring-discord-blurple"
                >
                  <option value="">Select a server...</option>
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-discord-text-secondary uppercase">
                  Channel
                </Label>
                <select
                  value={selectedChannelId}
                  onChange={(e) => setSelectedChannelId(e.target.value)}
                  disabled={!selectedWorkspaceId || channels.length === 0}
                  className="w-full px-3 py-2 bg-discord-channel-sidebar border border-discord-hover rounded-md text-white focus:outline-none focus:ring-2 focus:ring-discord-blurple disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!selectedWorkspaceId
                      ? "Select a server first..."
                      : channels.length === 0
                      ? "No channels available"
                      : "Select a channel..."}
                  </option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-discord-text-secondary uppercase">
                  Message ID or URL
                </Label>
                <Input
                  placeholder="Optional: Message ID or URL for editing"
                  value={channelMessageIdOrUrl}
                  onChange={(e) => setChannelMessageIdOrUrl(e.target.value)}
                  className="bg-discord-channel-sidebar border-discord-hover text-white"
                />
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2 justify-end">
                <Button
                  onClick={handleRestoreMessage}
                  disabled={isRestoring || !channelMessageIdOrUrl}
                  variant="outline"
                  className="border-discord-hover text-discord-text-secondary hover:text-white hover:bg-discord-hover"
                >
                  {isRestoring ? "Restoring..." : "Restore Message"}
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={
                    !selectedChannelId ||
                    (!content && embeds.length === 0) ||
                    isSending
                  }
                  className="bg-discord-blurple hover:bg-discord-blurple/90 text-white"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      {channelMessageIdOrUrl ? "Edit Message" : "Send Message"}
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {/* Message Format Toggle */}
          <Tabs value={messageFormat} onValueChange={(value) => setMessageFormat(value as "embeds" | "components")}>
            <TabsList className="w-fit bg-discord-hover p-1">
              <TabsTrigger 
                value="embeds"
                className="text-discord-text-muted data-[state=active]:bg-discord-blurple dark:data-[state=active]:bg-discord-blurple data-[state=active]:hover:bg-discord-blurple/90 data-[state=active]:text-white dark:data-[state=active]:text-white data-[state=inactive]:bg-transparent"
              >
                Embeds V1
              </TabsTrigger>
              <TabsTrigger 
                value="components"
                className="text-discord-text-muted data-[state=active]:bg-discord-blurple dark:data-[state=active]:bg-discord-blurple data-[state=active]:hover:bg-discord-blurple/90 data-[state=active]:text-white dark:data-[state=active]:text-white data-[state=inactive]:bg-transparent"
              >
                Components V2
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Toolbar */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-2 hover:bg-discord-hover rounded text-discord-text-muted hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Undo"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-2 hover:bg-discord-hover rounded text-discord-text-muted hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Redo"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              onClick={handleDelete}
              className="p-2 hover:bg-discord-hover rounded text-discord-text-muted hover:text-white transition-colors"
              title="Clear All"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={handleExportJson}
              className="p-2 hover:bg-discord-hover rounded text-discord-text-muted hover:text-white transition-colors"
              title="Export JSON"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={handleShare}
              className="p-2 hover:bg-discord-hover rounded text-discord-text-muted hover:text-white transition-colors"
              title="Share"
            >
              <Link2 className="h-4 w-4" />
            </button>
          </div>

          {/* Username and Avatar URL */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-discord-text-secondary uppercase">
                Username {webhookUsername.length}/80
              </Label>
              <Input
                placeholder="Embed Generator"
                value={webhookUsername}
                onChange={(e) => {
                  if (e.target.value.length <= 80) {
                    setWebhookUsername(e.target.value);
                    pushToHistory();
                  }
                }}
                className="bg-discord-channel-sidebar border-discord-hover text-white"
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-discord-text-secondary uppercase">
                Avatar URL
              </Label>
              <div className="relative">
                <Input
                  placeholder="https://..."
                  value={webhookAvatarUrl}
                  onChange={(e) => {
                    setWebhookAvatarUrl(e.target.value);
                    pushToHistory();
                  }}
                  className="bg-discord-channel-sidebar border-discord-hover text-white pr-10"
                />
                {webhookAvatarUrl && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(webhookAvatarUrl);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-discord-hover rounded text-discord-text-muted hover:text-white"
                    title="Copy URL"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* Content Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-discord-text-secondary uppercase">
                Content {contentLength}/{MAX_CONTENT_LENGTH}
              </Label>
              <div className="flex gap-1">
                <button
                  onClick={handleBold}
                  className="p-1.5 hover:bg-discord-hover rounded text-discord-text-muted hover:text-white transition-colors"
                  title="Bold"
                >
                  <Bold className="h-4 w-4" />
                </button>
                <button
                  onClick={handleItalic}
                  className="p-1.5 hover:bg-discord-hover rounded text-discord-text-muted hover:text-white transition-colors"
                  title="Italic"
                >
                  <Italic className="h-4 w-4" />
                </button>
                <button
                  onClick={handleUnderline}
                  className="p-1.5 hover:bg-discord-hover rounded text-discord-text-muted hover:text-white transition-colors"
                  title="Underline"
                >
                  <Underline className="h-4 w-4" />
                </button>
                <button
                  onClick={handleStrikethrough}
                  className="p-1.5 hover:bg-discord-hover rounded text-discord-text-muted hover:text-white transition-colors"
                  title="Strikethrough"
                >
                  <Strikethrough className="h-4 w-4" />
                </button>
                <button
                  onClick={handleSpoiler}
                  className="p-1.5 hover:bg-discord-hover rounded text-discord-text-muted hover:text-white transition-colors"
                  title="Spoiler"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  onClick={handleLink}
                  className="p-1.5 hover:bg-discord-hover rounded text-discord-text-muted hover:text-white transition-colors"
                  title="Link"
                >
                  <LinkIcon className="h-4 w-4" />
                </button>
                <button
                  className="p-1.5 hover:bg-discord-hover rounded text-discord-text-muted hover:text-white transition-colors"
                  title="Emoji"
                >
                  <Smile className="h-4 w-4" />
                </button>
              </div>
            </div>
            <Textarea
              placeholder="Type your message here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[200px] bg-discord-channel-sidebar border-discord-hover text-white resize-none"
              maxLength={MAX_CONTENT_LENGTH}
            />
          </div>

          {/* Attachments Section */}
          <div className="border border-discord-hover rounded-lg overflow-hidden">
            <button
              onClick={() => setAttachmentsOpen(!attachmentsOpen)}
              className="w-full px-4 py-2 flex items-center justify-between bg-discord-channel-sidebar hover:bg-discord-hover transition-colors"
            >
              <span className="text-sm font-semibold text-discord-text-secondary uppercase">
                Attachments {attachments.length}/10{" "}
                {(() => {
                  const totalSize = attachments.reduce(
                    (acc, file) => acc + file.size,
                    0
                  );
                  const mbSize = (totalSize / (1024 * 1024)).toFixed(2);
                  return ` ${mbSize}/25MB`;
                })()}
              </span>
              {attachmentsOpen ? (
                <ChevronUp className="h-4 w-4 text-discord-text-muted" />
              ) : (
                <ChevronDown className="h-4 w-4 text-discord-text-muted" />
              )}
            </button>
            {attachmentsOpen && (
              <div className="p-4 bg-discord-channel-sidebar">
                <AttachmentManager
                  attachments={attachments}
                  onAttachmentsChange={setAttachments}
                />
              </div>
            )}
          </div>

          {/* Embeds Section */}
          <div className={`border border-discord-hover rounded-lg overflow-hidden ${messageFormat !== "embeds" ? "opacity-50" : ""}`}>
            <button
              onClick={() => setEmbedsOpen(!embedsOpen)}
              className="w-full px-4 py-2 flex items-center justify-between bg-discord-channel-sidebar hover:bg-discord-hover transition-colors"
            >
              <span className="text-sm font-semibold text-discord-text-secondary uppercase">
                Embeds {embeds.length}/10
              </span>
              {embedsOpen ? (
                <ChevronUp className="h-4 w-4 text-discord-text-muted" />
              ) : (
                <ChevronDown className="h-4 w-4 text-discord-text-muted" />
              )}
            </button>
            {embedsOpen && (
              <div className="p-4 bg-discord-channel-sidebar space-y-4">
                {embeds.map((embed, index) => (
                  <EmbedForm
                    key={index}
                    embed={embed}
                    index={index}
                    onUpdate={(updates) => updateEmbed(index, updates)}
                    onRemove={() => removeEmbed(index)}
                  />
                ))}
                <div className="flex gap-2">
                  <Button
                    onClick={addEmbed}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Embed
                  </Button>
                  {embeds.length > 0 && (
                    <Button
                      onClick={clearEmbeds}
                      variant="outline"
                      className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                      size="sm"
                    >
                      Clear Embeds
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Components Section */}
          <div className={`border border-discord-hover rounded-lg overflow-hidden ${messageFormat !== "components" ? "opacity-50" : ""}`}>
            <button
              onClick={() => setComponentsOpen(!componentsOpen)}
              className="w-full px-4 py-2 flex items-center justify-between bg-discord-channel-sidebar hover:bg-discord-hover transition-colors"
            >
              <span className="text-sm font-semibold text-discord-text-secondary uppercase">
                Components {components.length}/5{" "}
                <span className="text-xs">ADVANCED</span>
              </span>
              {componentsOpen ? (
                <ChevronUp className="h-4 w-4 text-discord-text-muted" />
              ) : (
                <ChevronDown className="h-4 w-4 text-discord-text-muted" />
              )}
            </button>
            {componentsOpen && (
              <div className="p-4 bg-discord-channel-sidebar space-y-4">
                {mode === "webhook" && (
                  <p className="text-xs text-orange-400 bg-orange-600/20 border border-orange-600/30 p-2 rounded">
                    Interactive components are only available when selecting a server and channel instead of sending to a webhook.
                  </p>
                )}
                {mode === "channel" && !selectedChannelId && (
                  <p className="text-xs text-orange-400 bg-orange-600/20 border border-orange-600/30 p-2 rounded">
                    Please select a channel to use interactive components.
                  </p>
                )}
                <ComponentManager
                  components={components}
                  onComponentsChange={setComponents}
                  disabled={mode === "webhook" || !selectedChannelId}
                />
              </div>
            )}
          </div>

        </div>
      </div>

      {/* JSON Editor Modal */}
      <JsonEditorModal
        open={isJsonModalOpen}
        onOpenChange={setIsJsonModalOpen}
        messageData={buildDiscordMessagePayload()}
        onSave={handleSaveJson}
      />

      {/* Save Template Modal */}
      <SaveTemplateModal
        open={isSaveTemplateModalOpen}
        onOpenChange={setIsSaveTemplateModalOpen}
        messageData={buildDiscordMessagePayload()}
        components={components}
        onSuccess={() => {
          toast.success("Template saved successfully!");
        }}
      />

      {/* Right Panel - Preview */}
      <div className="w-96 border-l border-discord-hover overflow-hidden">
        <EmbedEditorPreview
          content={content}
          embeds={embeds}
          attachments={attachments}
          components={components}
        />
      </div>
    </div>
  );
}

