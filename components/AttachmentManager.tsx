"use client";

import { Button } from "@/components/ui/button";
import { X, Upload } from "lucide-react";

interface AttachmentManagerProps {
  attachments: File[];
  onAttachmentsChange: (attachments: File[]) => void;
}

const MAX_ATTACHMENTS = 10;
const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB

export function AttachmentManager({
  attachments,
  onAttachmentsChange,
}: AttachmentManagerProps) {
  const totalSize = attachments.reduce((acc, file) => acc + file.size, 0);
  const canAddMore =
    attachments.length < MAX_ATTACHMENTS && totalSize < MAX_TOTAL_SIZE;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments: File[] = [];

    for (const file of files) {
      if (attachments.length + newAttachments.length >= MAX_ATTACHMENTS) {
        alert(`Maximum ${MAX_ATTACHMENTS} attachments allowed`);
        break;
      }

      const newTotalSize = totalSize + newAttachments.reduce((acc, f) => acc + f.size, 0) + file.size;
      if (newTotalSize > MAX_TOTAL_SIZE) {
        alert("Total attachment size cannot exceed 25MB");
        break;
      }

      newAttachments.push(file);
    }

    if (newAttachments.length > 0) {
      onAttachmentsChange([...attachments, ...newAttachments]);
    }

    // Reset input
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-discord-hover rounded border border-discord-hover"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{file.name}</div>
                <div className="text-xs text-discord-text-muted">
                  {(file.size / 1024).toFixed(2)} KB
                </div>
              </div>
              <Button
                onClick={() => removeAttachment(index)}
                variant="ghost"
                size="sm"
                className="ml-2 text-red-400 hover:text-red-300 hover:bg-red-500/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {canAddMore ? (
        <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-discord-hover rounded-lg cursor-pointer hover:bg-discord-hover transition-colors">
          <Upload className="h-4 w-4 text-discord-text-muted" />
          <span className="text-sm text-discord-text-secondary">
            Click to upload files
          </span>
          <input
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      ) : (
        <div className="text-xs text-discord-text-muted text-center p-2">
          Maximum attachments reached or size limit exceeded
        </div>
      )}
    </div>
  );
}

