"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AddChannelModal } from "@/components/modals/AddChannelModal";
import { ChannelSettingsModal } from "@/components/modals/ChannelSettingsModal";
import { ChevronDown, Hash, Plus, Settings } from "lucide-react";

interface Channel {
  id: string;
  name: string;
  workspace_id: string;
  webhook_url?: string;
  webhook_username?: string | null;
  webhook_avatar_url?: string | null;
}

interface ChannelsSidebarProps {
  workspaceId: string | null;
  workspaceName?: string;
  selectedChannelId: string | null;
  onChannelSelect: (channelId: string) => void;
}

export function ChannelsSidebar({
  workspaceId,
  workspaceName,
  selectedChannelId,
  onChannelSelect,
}: ChannelsSidebarProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedChannelForSettings, setSelectedChannelForSettings] = useState<Channel | null>(null);

  useEffect(() => {
    if (workspaceId) {
      fetchChannels();
    } else {
      setChannels([]);
    }
  }, [workspaceId]);

  const fetchChannels = async () => {
    if (!workspaceId) return;

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

  if (!workspaceId) {
    return (
      <div className="w-60 bg-discord-channel-sidebar flex flex-col" />
    );
  }

  return (
    <div className="w-60 bg-discord-channel-sidebar flex flex-col text-discord-text-primary">
      {/* Server Name Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-discord-hover shadow-sm">
        <button className="flex items-center gap-1 text-white font-semibold text-sm hover:text-gray-200 transition-colors">
          <span>{workspaceName || "Server"}</span>
          <ChevronDown className="h-4 w-4" />
        </button>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="text-discord-text-muted hover:text-discord-text-primary transition-colors"
          title="Add Channel"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col">
        {channels.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-discord-text-muted">
            No channels yet
          </div>
        ) : (
          <div className="space-y-0.5 flex-1">
            {channels.map((channel) => {
              const isSelected = selectedChannelId === channel.id;
              return (
                <button
                  key={channel.id}
                  onClick={() => onChannelSelect(channel.id)}
                  className={`group relative w-full text-left px-2 py-1.5 rounded flex items-center gap-1.5 text-sm transition-all duration-150 ${
                    isSelected
                      ? "bg-discord-hover text-white"
                      : "text-discord-text-secondary hover:bg-discord-hover hover:text-white"
                  }`}
                >
                  <Hash className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 truncate">{channel.name}</span>
                  {isSelected && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedChannelForSettings(channel);
                        setIsSettingsModalOpen(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
                      title="Channel Settings"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                  )}
                  {/* Active indicator */}
                  {isSelected && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full" />
                  )}
                </button>
              );
            })}
          </div>
        )}
        
        {/* Add Channel Button */}
        <div className="px-2 pt-2 mt-auto">
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="w-full bg-discord-blurple hover:bg-discord-blurple/90 text-white font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Channel
          </Button>
        </div>
      </div>

      {workspaceId && (
        <>
          <AddChannelModal
            open={isAddModalOpen}
            onOpenChange={setIsAddModalOpen}
            workspaceId={workspaceId}
            onSuccess={fetchChannels}
          />
          <ChannelSettingsModal
            open={isSettingsModalOpen}
            onOpenChange={setIsSettingsModalOpen}
            channel={selectedChannelForSettings}
            onSuccess={fetchChannels}
          />
        </>
      )}
    </div>
  );
}


