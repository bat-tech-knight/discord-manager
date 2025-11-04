"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect, useRef } from "react";
import {
  Pencil,
  Save,
  Calendar,
  Terminal,
  Wrench,
  LogOut,
  Settings,
  ChevronsLeft,
  ChevronDown,
} from "lucide-react";

interface Workspace {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface EditorSidebarProps {
  onLogout?: () => void;
}

export function EditorSidebar({ onLogout }: EditorSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [serverSectionHeight, setServerSectionHeight] = useState<number>(120);
  const [isResizing, setIsResizing] = useState(false);
  const splitterRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch workspaces on mount
  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch("/api/workspaces");
      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data.workspaces || []);
        if (data.workspaces && data.workspaces.length > 0) {
          setSelectedWorkspaceId(data.workspaces[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
    }
  };

  // Handle splitter resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newHeight = e.clientY - containerRect.top;
      const minHeight = 80;
      const maxHeight = containerRect.height - 200; // Leave space for bottom section

      if (newHeight >= minHeight && newHeight <= maxHeight) {
        setServerSectionHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
    } else {
      // Default logout behavior
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/auth/login");
      router.refresh();
    }
  };

  const navItems = [
    {
      label: "Message Editor",
      icon: Pencil,
      path: "/protected/editor",
    },
    {
      label: "Saved Templates",
      icon: Save,
      path: "/protected/editor/saved",
    },
    {
      label: "Scheduled Messages",
      icon: Calendar,
      path: "/protected/editor/scheduled",
    },
    {
      label: "Commands",
      icon: Terminal,
      path: "/protected/editor/commands",
    },
    {
      label: "Utility Tools",
      icon: Wrench,
      path: "/protected/editor/utility",
    },
  ];

  return (
    <div 
      ref={containerRef}
      className="w-64 bg-discord-server-list flex flex-col h-screen border-r border-discord-hover"
    >
      {/* Server Selection Section */}
      <div 
        className="flex flex-col overflow-hidden"
        style={{ height: `${serverSectionHeight}px`, minHeight: '80px' }}
      >
        <div className="p-4 flex-1 flex flex-col">
          <button 
            onClick={() => router.push("/protected")}
            className="text-discord-text-muted hover:text-white transition-colors mb-3"
            title="Back to Message Dashboard"
          >
            <ChevronsLeft className="h-5 w-5" />
          </button>
          
          {/* Server Selection Dropdown */}
          <div className="space-y-2 flex-1">
            <label className="text-xs font-semibold text-discord-text-muted uppercase tracking-wide">
              Server
            </label>
            <div className="relative">
              <select
                value={selectedWorkspaceId}
                onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                className="w-full px-3 py-2 bg-discord-channel-sidebar border border-discord-hover rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-discord-blurple appearance-none cursor-pointer hover:bg-discord-hover transition-colors"
              >
                {workspaces.length === 0 ? (
                  <option value="">Loading servers...</option>
                ) : (
                  workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-discord-text-muted pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Resizable Splitter */}
      <div
        ref={splitterRef}
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        className="h-1 bg-discord-hover hover:bg-discord-blurple cursor-row-resize transition-colors relative group flex-shrink-0"
        style={{ minHeight: '4px' }}
        title="Drag to resize"
      >
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-discord-blurple transition-opacity" />
      </div>

      {/* Navigation Links Section */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path ||
            (item.path === "/protected/editor" &&
              pathname?.startsWith("/protected/editor") &&
              !navItems.some(
                (ni) =>
                  ni.path !== "/protected/editor" && pathname === ni.path
              ));

          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                isActive
                  ? "bg-discord-blurple text-white"
                  : "text-discord-text-secondary hover:bg-discord-hover hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Bottom section */}
      <div className="p-2 space-y-1 border-t border-discord-hover">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-discord-text-secondary hover:bg-discord-hover hover:text-white transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-medium">Logout</span>
        </button>
        <Link
          href="/protected/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-discord-text-secondary hover:bg-discord-hover hover:text-white transition-colors"
        >
          <Settings className="h-5 w-5" />
          <span className="text-sm font-medium">Settings</span>
        </Link>
      </div>
    </div>
  );
}

