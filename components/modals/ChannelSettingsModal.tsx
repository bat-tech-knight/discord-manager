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

interface ChannelData {
  id: string;
  name: string;
  webhook_url?: string;
  webhook_username?: string | null;
  webhook_avatar_url?: string | null;
}

interface ChannelSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: ChannelData | null;
  onSuccess: () => void;
}

export function ChannelSettingsModal({
  open,
  onOpenChange,
  channel,
  onSuccess,
}: ChannelSettingsModalProps) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookUsername, setWebhookUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load channel settings when modal opens or channel changes
  useEffect(() => {
    if (open && channel) {
      setWebhookUrl(channel.webhook_url || "");
      setWebhookUsername(channel.webhook_username || "");
    } else {
      // Reset form when modal closes
      setWebhookUrl("");
      setWebhookUsername("");
    }
  }, [open, channel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channel?.id || !webhookUrl) return;

    setLoading(true);
    try {
      const response = await fetch("/api/channels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: channel.id,
          name: channel.name, // Keep existing name
          webhook_url: webhookUrl,
          webhook_username: webhookUsername || null,
          webhook_avatar_url: channel.webhook_avatar_url || null, // Preserve existing avatar
        }),
      });

      if (response.ok) {
        onOpenChange(false);
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update channel settings");
      }
    } catch (error) {
      console.error("Failed to update channel settings:", error);
      alert("Failed to update channel settings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!channel?.id) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/channels?id=${channel.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setShowDeleteConfirm(false);
        onOpenChange(false);
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete channel");
      }
    } catch (error) {
      console.error("Failed to delete channel:", error);
      alert("Failed to delete channel. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open && !showDeleteConfirm} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Channel Settings</DialogTitle>
            <DialogDescription>
              Update the webhook URL and username for this channel
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <Input
                  id="webhook-url"
                  type="url"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="webhook-username">Webhook Username</Label>
                <Input
                  id="webhook-username"
                  placeholder="Optional: Custom username for webhook messages"
                  value={webhookUsername}
                  onChange={(e) => setWebhookUsername(e.target.value)}
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
                Delete Channel
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
            <DialogTitle>Delete Channel</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{channel?.name}"? This action cannot be undone and will also delete all messages associated with this channel.
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
              {deleting ? "Deleting..." : "Delete Channel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

