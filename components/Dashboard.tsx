"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ServerSidebar } from "@/components/ServerSidebar";
import { ChannelsSidebar } from "@/components/ChannelsSidebar";
import { MessageArea } from "@/components/MessageArea";
import { AddServerModal } from "@/components/modals/AddServerModal";
import { LoadTemplateModal } from "@/components/modals/LoadTemplateModal";
import { SaveTemplateModal } from "@/components/modals/SaveTemplateModal";

interface Workspace {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface Channel {
  id: string;
  name: string;
  webhook_url?: string;
  webhook_username?: string | null;
  webhook_avatar_url?: string | null;
}

export function Dashboard() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null
  );
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null
  );
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [isLoadTemplateModalOpen, setIsLoadTemplateModalOpen] = useState(false);
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);

  // Composer state
  const [content, setContent] = useState("");
  const [embedData, setEmbedData] = useState<any>(null);
  const [settingsData, setSettingsData] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspaceId) {
      fetchChannelDetails();
    }
  }, [selectedChannelId]);

  useEffect(() => {
    if (selectedWorkspaceId) {
      // When workspace changes, fetch channels and auto-select the first one
      fetchChannelsAndSelectFirst();
    } else {
      // Clear channel selection when workspace is cleared
      setSelectedChannelId(null);
      setSelectedChannel(null);
    }
  }, [selectedWorkspaceId]);

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch("/api/workspaces");
      if (response.ok) {
        const data = await response.json();
        const workspacesList = data.workspaces || [];
        setWorkspaces(workspacesList);
        
        // Check if currently selected workspace still exists
        if (selectedWorkspaceId) {
          const workspaceExists = workspacesList.some(
            (w: Workspace) => w.id === selectedWorkspaceId
          );
          if (!workspaceExists) {
            // Selected workspace was deleted, clear selection and channel
            setSelectedWorkspaceId(null);
            setSelectedChannelId(null);
            setSelectedChannel(null);
          }
        }
        
        // If no workspace is selected and there are workspaces available, select the first one
        if (workspacesList.length > 0 && !selectedWorkspaceId) {
          setSelectedWorkspaceId(workspacesList[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
    }
  };

  const fetchChannelsAndSelectFirst = async () => {
    if (!selectedWorkspaceId) return;

    try {
      const response = await fetch(`/api/channels?workspace_id=${selectedWorkspaceId}`);
      if (response.ok) {
        const data = await response.json();
        const channels = data.channels || [];
        
        // If no channel is selected, or the currently selected channel doesn't exist in this workspace, select the first one
        if (channels.length > 0) {
          if (!selectedChannelId || !channels.some((c: Channel) => c.id === selectedChannelId)) {
            const firstChannel = channels[0];
            setSelectedChannelId(firstChannel.id);
            setSelectedChannel(firstChannel);
          } else {
            // Keep the current selection, just update the channel details
            const channel = channels.find((c: Channel) => c.id === selectedChannelId);
            setSelectedChannel(channel || null);
          }
        } else {
          // No channels available, clear selection
          setSelectedChannelId(null);
          setSelectedChannel(null);
        }
      }
    } catch (error) {
      console.error("Failed to fetch channels:", error);
    }
  };

  const fetchChannelDetails = async () => {
    if (!selectedChannelId) {
      setSelectedChannel(null);
      return;
    }

    try {
      const response = await fetch(`/api/channels?workspace_id=${selectedWorkspaceId}`);
      if (response.ok) {
        const data = await response.json();
        const channel = data.channels?.find(
          (c: Channel) => c.id === selectedChannelId
        );
        setSelectedChannel(channel || null);
      }
    } catch (error) {
      console.error("Failed to fetch channel details:", error);
    }
  };

  const handleSend = async () => {
    if (!selectedChannelId) return;

    try {
      const embedPayload = embedData
        ? {
            ...embedData,
            color: embedData.color
              ? typeof embedData.color === "string"
                ? parseInt(embedData.color.replace("#", ""), 16)
                : embedData.color
              : undefined,
          }
        : undefined;

      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel_id: selectedChannelId,
          content: content || null,
          embed_data: embedPayload || null,
          webhook_username: settingsData?.webhook_username,
          webhook_avatar_url: settingsData?.webhook_avatar_url,
        }),
      });

      if (response.ok) {
        // Clear composer
        setContent("");
        setEmbedData(null);
        setSettingsData(null);
        // Trigger refresh of message history
        setRefreshTrigger((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message. Please check the console for details.");
    }
  };

  const normalizeEmbedColor = (embed: any) => {
    if (!embed || !embed.color) return embed;
    
    // Convert numeric color to hex string if needed
    if (typeof embed.color === "number") {
      return {
        ...embed,
        color: `#${embed.color.toString(16).padStart(6, "0")}`,
      };
    }
    return embed;
  };

  const handleLoadTemplate = (template: any) => {
    setContent(template.content || "");
    setEmbedData(normalizeEmbedColor(template.embed_data));
    setSettingsData(template.settings_data);
  };

  const handleEditMessage = (message: any) => {
    if (!selectedChannelId) return;
    
    // Navigate to editor page with channel and Discord message ID
    const params = new URLSearchParams({
      channel_id: selectedChannelId,
      workspace_id: selectedWorkspaceId || "",
      db_message_id: message.id,
    });
    
    // Use Discord message ID if available, otherwise the user can manually enter it
    if (message.discord_message_id) {
      params.set("channel_message_id", message.discord_message_id);
      // Also set generic message_id so webhook tab can prefill
      params.set("message_id", message.discord_message_id);
    }
    
    // Also prefill webhook editor if channel has a webhook configured
    if (selectedChannel?.webhook_url) {
      params.set("webhook_url", selectedChannel.webhook_url);
      if (selectedChannel.webhook_username) {
        params.set("webhook_username", selectedChannel.webhook_username);
      }
      if (selectedChannel.webhook_avatar_url) {
        params.set("webhook_avatar_url", selectedChannel.webhook_avatar_url);
      }
    }
    
    router.push(`/protected/editor?${params.toString()}`);
  };

  return (
    <div className="h-screen flex overflow-hidden bg-discord-message-area">
      {/* Server Sidebar */}
      <ServerSidebar
        workspaces={workspaces}
        selectedWorkspaceId={selectedWorkspaceId}
        onWorkspaceSelect={setSelectedWorkspaceId}
        onWorkspaceAdd={fetchWorkspaces}
      />

      {/* Channel Sidebar */}
      <ChannelsSidebar
        workspaceId={selectedWorkspaceId}
        workspaceName={
          workspaces.find((w) => w.id === selectedWorkspaceId)?.name
        }
        selectedChannelId={selectedChannelId}
        onChannelSelect={setSelectedChannelId}
      />

      {/* Main Content Area */}
      <MessageArea
        channelId={selectedChannelId}
        channelName={selectedChannel?.name}
        content={content}
        embedData={embedData}
        settingsData={settingsData}
        onContentChange={setContent}
        onEmbedDataChange={setEmbedData}
        onSettingsDataChange={setSettingsData}
        onSend={handleSend}
        onEditMessage={handleEditMessage}
        onSaveTemplate={() => setIsSaveTemplateModalOpen(true)}
        onLoadTemplate={() => setIsLoadTemplateModalOpen(true)}
        refreshTrigger={refreshTrigger}
      />

      {/* Modals */}
      <LoadTemplateModal
        open={isLoadTemplateModalOpen}
        onOpenChange={setIsLoadTemplateModalOpen}
        onLoad={handleLoadTemplate}
        onDelete={() => {
          // Template deleted, refresh is handled in modal
        }}
      />

      <SaveTemplateModal
        open={isSaveTemplateModalOpen}
        onOpenChange={setIsSaveTemplateModalOpen}
        content={content}
        embedData={embedData}
        settingsData={settingsData}
        onSuccess={() => {
          // Template saved successfully
        }}
      />
    </div>
  );
}

