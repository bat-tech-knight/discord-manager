"use client";

import { useState } from "react";
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

interface SaveTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content?: string;
  embedData?: any;
  settingsData?: any;
  messageData?: any;
  components?: any[];
  onSuccess: () => void;
}

export function SaveTemplateModal({
  open,
  onOpenChange,
  content,
  embedData,
  settingsData,
  messageData,
  components,
  onSuccess,
}: SaveTemplateModalProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setLoading(true);
    try {
      // Build message_data from current editor state
      let message_data = null;
      if (messageData) {
        // If messageData is provided, use it and add components if present
        message_data = {
          ...messageData,
          components: components && components.length > 0 ? components : (messageData.components || []),
        };
      } else if (content || embedData) {
        // Fallback to legacy format if messageData not provided
        message_data = {
          content: content || null,
          embeds: embedData ? (Array.isArray(embedData) ? embedData : [embedData]) : null,
          components: components && components.length > 0 ? components : null,
          username: settingsData?.webhook_username || null,
          avatar_url: settingsData?.webhook_avatar_url || null,
        };
      }

      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          message_data,
        }),
      });

      if (response.ok) {
        setName("");
        onOpenChange(false);
        onSuccess();
      } else {
        const error = await response.json();
        console.error("Failed to save template:", error);
      }
    } catch (error) {
      console.error("Failed to save template:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Template</DialogTitle>
          <DialogDescription>
            Save the current message as a template for future use
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                placeholder="e.g., Weekly Update"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              Save Template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


