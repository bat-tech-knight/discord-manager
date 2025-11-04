"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft } from "lucide-react";

interface EmbedData {
  title?: string;
  description?: string;
  color?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

interface SettingsData {
  webhook_username?: string;
  webhook_avatar_url?: string;
}

interface ComposerProps {
  content: string;
  embedData: EmbedData | null;
  settingsData: SettingsData | null;
  onContentChange: (content: string) => void;
  onEmbedDataChange: (data: EmbedData | null) => void;
  onSettingsDataChange: (data: SettingsData | null) => void;
}

export function Composer({
  content,
  embedData,
  settingsData,
  onContentChange,
  onEmbedDataChange,
  onSettingsDataChange,
}: ComposerProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [embedFields, setEmbedFields] = useState<
    Array<{ name: string; value: string; inline?: boolean }>
  >(embedData?.fields || []);

  useEffect(() => {
    if (embedData?.fields) {
      setEmbedFields(embedData.fields);
    }
  }, [embedData]);

  const updateEmbedData = (updates: Partial<EmbedData>) => {
    onEmbedDataChange({
      ...embedData,
      ...updates,
    } as EmbedData);
  };

  const addEmbedField = () => {
    const newFields = [...embedFields, { name: "", value: "" }];
    setEmbedFields(newFields);
    updateEmbedData({ fields: newFields });
  };

  const updateEmbedField = (index: number, updates: Partial<NonNullable<EmbedData["fields"]>[0]>) => {
    const newFields = [...embedFields];
    newFields[index] = { ...newFields[index], ...updates };
    setEmbedFields(newFields);
    updateEmbedData({ fields: newFields });
  };

  const removeEmbedField = (index: number) => {
    const newFields = embedFields.filter((_, i) => i !== index);
    setEmbedFields(newFields);
    updateEmbedData({ fields: newFields });
  };

  if (collapsed) {
    return (
      <div className="flex-1 border-x border-border bg-background flex items-center justify-center">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 hover:bg-accent rounded-md"
        >
          <ChevronLeft className="rotate-180" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 border-x border-border bg-background flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-sm uppercase tracking-wide">
          Composer
        </h2>
        <button
          onClick={() => setCollapsed(true)}
          className="p-2 hover:bg-accent rounded-md"
        >
          <ChevronLeft />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Tabs defaultValue="content" className="h-full flex flex-col">
          <TabsList>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="embed">Embed</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="flex-1 mt-4">
            <div className="space-y-2">
              <Label>Message Content</Label>
              <Textarea
                placeholder="Type your message here..."
                value={content}
                onChange={(e) => onContentChange(e.target.value)}
                className="min-h-[400px] resize-none"
              />
            </div>
          </TabsContent>

          <TabsContent value="embed" className="flex-1 mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Embed Title</Label>
              <Input
                value={embedData?.title || ""}
                onChange={(e) => updateEmbedData({ title: e.target.value })}
                placeholder="Embed title"
              />
            </div>

            <div className="space-y-2">
              <Label>Embed Description</Label>
              <Textarea
                value={embedData?.description || ""}
                onChange={(e) =>
                  updateEmbedData({ description: e.target.value })
                }
                placeholder="Embed description"
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Embed Color (hex)</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={embedData?.color || "#5865F2"}
                  onChange={(e) => updateEmbedData({ color: e.target.value })}
                  className="w-20 h-9"
                />
                <Input
                  value={embedData?.color || ""}
                  onChange={(e) => updateEmbedData({ color: e.target.value })}
                  placeholder="#5865F2"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Fields</Label>
                <button
                  onClick={addEmbedField}
                  className="text-sm text-primary hover:underline"
                >
                  + Add Field
                </button>
              </div>
              <div className="space-y-2">
                {embedFields.map((field, index) => (
                  <div key={index} className="p-3 border rounded-md space-y-2">
                    <Input
                      placeholder="Field name"
                      value={field.name}
                      onChange={(e) =>
                        updateEmbedField(index, { name: e.target.value })
                      }
                    />
                    <Textarea
                      placeholder="Field value"
                      value={field.value}
                      onChange={(e) =>
                        updateEmbedField(index, { value: e.target.value })
                      }
                      className="min-h-[60px]"
                    />
                    <div className="flex items-center justify-between">
                      <label className="text-sm flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={field.inline || false}
                          onChange={(e) =>
                            updateEmbedField(index, { inline: e.target.checked })
                          }
                        />
                        Inline
                      </label>
                      <button
                        onClick={() => removeEmbedField(index)}
                        className="text-sm text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="flex-1 mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Webhook Username</Label>
              <Input
                value={settingsData?.webhook_username || ""}
                onChange={(e) =>
                  onSettingsDataChange({
                    ...settingsData,
                    webhook_username: e.target.value,
                  })
                }
                placeholder="Override webhook username"
              />
            </div>

            <div className="space-y-2">
              <Label>Webhook Avatar URL</Label>
              <Input
                value={settingsData?.webhook_avatar_url || ""}
                onChange={(e) =>
                  onSettingsDataChange({
                    ...settingsData,
                    webhook_avatar_url: e.target.value,
                  })
                }
                placeholder="https://..."
                type="url"
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


