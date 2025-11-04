"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface WorkspaceData {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface ServerSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: WorkspaceData | null;
  onSuccess: () => void;
}

export function ServerSettingsModal({
  open,
  onOpenChange,
  workspace,
  onSuccess,
}: ServerSettingsModalProps) {
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load workspace settings when modal opens or workspace changes
  useEffect(() => {
    if (open && workspace) {
      setName(workspace.name || "");
      setAvatarUrl(workspace.avatar_url || "");
    } else {
      // Reset form when modal closes
      setName("");
      setAvatarUrl("");
    }
  }, [open, workspace]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace?.id || !name) return;

    setLoading(true);
    try {
      const response = await fetch("/api/workspaces", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: workspace.id,
          name,
          avatar_url: avatarUrl || null,
        }),
      });

      if (response.ok) {
        onOpenChange(false);
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update server settings");
      }
    } catch (error) {
      console.error("Failed to update server settings:", error);
      alert("Failed to update server settings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!workspace?.id) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/workspaces?id=${workspace.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setShowDeleteConfirm(false);
        onOpenChange(false);
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete server");
      }
    } catch (error) {
      console.error("Failed to delete server:", error);
      alert("Failed to delete server. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open && !showDeleteConfirm} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Server Settings</DialogTitle>
            <DialogDescription>
              Update the name and icon for this server
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="server-name">Server Name</Label>
                <Input
                  id="server-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="server-avatar">Server Icon URL (optional)</Label>
                <Input
                  id="server-avatar"
                  type="url"
                  placeholder="https://example.com/icon.png"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
            <DialogFooter className="flex justify-between">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading || deleting}
              >
                Delete Server
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading || deleting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || deleting}>
                  {loading ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Server</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{workspace?.name}"? This action cannot be undone and will also delete all channels and messages associated with this server.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Server"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

