"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { LogOut } from "lucide-react";

interface User {
  id: string;
  email?: string;
  avatar_url?: string;
  username?: string;
}

export function UserProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (currentUser) {
        setUser({
          id: currentUser.id,
          email: currentUser.email,
          avatar_url: currentUser.user_metadata?.avatar_url,
          username: currentUser.user_metadata?.username || currentUser.email?.split("@")[0],
        });
      }
    };

    fetchUser();
  }, []);

  const handleToggleMenu = () => {
    if (!isMenuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.top - 8, // Position above the button
        left: rect.right + 8,
      });
    }
    setIsMenuOpen(!isMenuOpen);
  };

  const handleLogout = async () => {
    try {
      setIsMenuOpen(false);
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Logout error:", error);
        alert("Failed to logout. Please try again.");
        return;
      }
      
      // Redirect to login page
      router.push("/auth/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
      alert("Failed to logout. Please try again.");
    }
  };

  if (!user) {
    return null;
  }

  const displayName = user.username || user.email?.split("@")[0] || "User";

  const menuContent = isMenuOpen && (
    <>
      <div
        className="fixed inset-0 z-[100]"
        onClick={() => setIsMenuOpen(false)}
      />
      <div
        className="fixed w-56 bg-discord-channel-sidebar border border-discord-hover rounded-lg shadow-xl z-[101]"
        style={{
          top: `${menuPosition.top}px`,
          left: `${menuPosition.left}px`,
          transform: 'translateY(-100%)', // Align to bottom of calculated position
        }}
      >
        <div className="p-3 border-b border-discord-hover">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-discord-blurple flex items-center justify-center flex-shrink-0">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={displayName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-white text-sm font-semibold">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white font-semibold truncate">
                {displayName}
              </div>
              {user.email && (
                <div className="text-xs text-discord-text-muted truncate">
                  {user.email}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="p-1">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-discord-hover hover:text-red-300 rounded transition-colors flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className="relative w-full">
        {/* Compact version for narrow sidebar */}
        <button
          ref={buttonRef}
          onClick={handleToggleMenu}
          className="w-full bg-discord-hover hover:bg-discord-server-list p-1.5 rounded flex items-center justify-center transition-colors duration-150 group"
          title={displayName}
        >
          <div className="w-10 h-10 rounded-full bg-discord-blurple flex items-center justify-center flex-shrink-0">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={displayName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-white text-xs font-semibold">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Render dropdown menu as portal */}
      {typeof window !== "undefined" && createPortal(menuContent, document.body)}
    </>
  );
}

