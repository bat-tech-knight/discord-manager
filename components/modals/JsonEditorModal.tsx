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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface JsonEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageData: any;
  onSave: (messageData: any) => void;
}

export function JsonEditorModal({
  open,
  onOpenChange,
  messageData,
  onSave,
}: JsonEditorModalProps) {
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Update jsonText when modal opens or messageData changes
  useEffect(() => {
    if (open && messageData) {
      try {
        setJsonText(JSON.stringify(messageData, null, 2));
        setError(null);
      } catch (e) {
        setError("Failed to format message data");
      }
    }
  }, [open, messageData]);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setError(null);
      onSave(parsed);
      onOpenChange(false);
    } catch (e) {
      setError("Invalid JSON format. Please check your syntax.");
    }
  };

  const handleCancel = () => {
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit JSON Message Data</DialogTitle>
          <DialogDescription>
            Edit the raw JSON data for your message. Changes will be applied to the editor.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col min-h-0">
          <Label htmlFor="json-editor" className="mb-2">
            Message JSON
          </Label>
          <Textarea
            id="json-editor"
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setError(null);
            }}
            className="flex-1 font-mono text-sm resize-none bg-discord-channel-sidebar border-discord-hover text-white"
            placeholder='{"content": "", "embeds": [], "components": []}'
          />
          {error && (
            <div className="mt-2 text-sm text-red-400 bg-red-500/20 border border-red-500/30 rounded p-2">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-discord-blurple hover:bg-discord-blurple/90">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

