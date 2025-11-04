"use client";

import { Plus } from "lucide-react";
import { AddServerModal } from "@/components/modals/AddServerModal";
import { ServerSettingsModal } from "@/components/modals/ServerSettingsModal";
import { UserProfile } from "@/components/UserProfile";
import { useState } from "react";

interface Workspace {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface ServerSidebarProps {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  onWorkspaceSelect: (workspaceId: string) => void;
  onWorkspaceAdd: () => void;
}

export function ServerSidebar({
  workspaces,
  selectedWorkspaceId,
  onWorkspaceSelect,
  onWorkspaceAdd,
}: ServerSidebarProps) {
  const [isAddServerModalOpen, setIsAddServerModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedWorkspaceForSettings, setSelectedWorkspaceForSettings] = useState<Workspace | null>(null);

  const handleAddSuccess = () => {
    setIsAddServerModalOpen(false);
    onWorkspaceAdd();
  };

  const handleWorkspaceRightClick = (e: React.MouseEvent, workspace: Workspace) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedWorkspaceForSettings(workspace);
    setIsSettingsModalOpen(true);
  };

  const handleSettingsSuccess = () => {
    setIsSettingsModalOpen(false);
    setSelectedWorkspaceForSettings(null);
    onWorkspaceAdd(); // Refresh workspaces list
  };

  return (
    <div className="w-[72px] bg-discord-server-list flex flex-col items-center py-2 gap-2 overflow-hidden">
      {/* Top section - scrollable */}
      <div className="flex flex-col items-center gap-2 overflow-y-auto flex-1 min-h-0 w-full">
        {/* Discord logo placeholder - can be replaced with actual logo */}
        <div className="w-12 h-12 rounded-full bg-discord-blurple flex items-center justify-center mb-1 cursor-pointer hover:rounded-2xl transition-all duration-200">
          <span className="text-white font-bold text-xl">D</span>
        </div>

        <div className="w-8 h-0.5 bg-border mb-1" />

        {/* Server icons */}
        <div className="flex flex-col items-center gap-2">
          {workspaces.map((workspace) => {
            const isActive = selectedWorkspaceId === workspace.id;
            return (
              <button
                key={workspace.id}
                onClick={() => onWorkspaceSelect(workspace.id)}
                onContextMenu={(e) => handleWorkspaceRightClick(e, workspace)}
                className={`group relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isActive
                    ? "bg-discord-blurple rounded-2xl"
                    : "bg-discord-hover hover:rounded-2xl hover:bg-discord-blurple"
                }`}
                title={`${workspace.name} (Right-click for settings)`}
              >
                {workspace.avatar_url ? (
                  <img
                    src={workspace.avatar_url}
                    alt={workspace.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white text-sm font-semibold">
                    {workspace.name.charAt(0).toUpperCase()}
                  </span>
                )}
                {/* Active indicator line */}
                {isActive && (
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />
                )}
              </button>
            );
          })}

          {/* Add Server Button */}
          <button
            onClick={() => setIsAddServerModalOpen(true)}
            className="w-12 h-12 rounded-full bg-discord-hover hover:rounded-2xl hover:bg-green-600 transition-all duration-200 flex items-center justify-center text-green-500 hover:text-white"
            title="Add a Server"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* User Profile at bottom */}
      <div className="w-full px-2 pb-2 flex-shrink-0">
        <UserProfile />
      </div>

      <AddServerModal
        open={isAddServerModalOpen}
        onOpenChange={setIsAddServerModalOpen}
        onSuccess={handleAddSuccess}
      />
      <ServerSettingsModal
        open={isSettingsModalOpen}
        onOpenChange={setIsSettingsModalOpen}
        workspace={selectedWorkspaceForSettings}
        onSuccess={handleSettingsSuccess}
      />
    </div>
  );
}

