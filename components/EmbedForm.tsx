"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, X, Copy } from "lucide-react";

interface Embed {
  title?: string;
  description?: string;
  color?: string;
  url?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  author?: { name?: string; icon_url?: string; url?: string };
  footer?: { text?: string; icon_url?: string };
  thumbnail?: { url: string };
  image?: { url: string };
  timestamp?: string;
}

interface EmbedFormProps {
  embed: Embed;
  index: number;
  onUpdate: (updates: Partial<Embed>) => void;
  onRemove: () => void;
}

export function EmbedForm({ embed, index, onUpdate, onRemove }: EmbedFormProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [fields, setFields] = useState<
    Array<{ name: string; value: string; inline?: boolean }>
  >(embed.fields || []);

  // Collapsible section states
  const [authorOpen, setAuthorOpen] = useState(true);
  const [bodyOpen, setBodyOpen] = useState(true);
  const [imagesOpen, setImagesOpen] = useState(true);
  const [footerOpen, setFooterOpen] = useState(true);
  const [fieldsOpen, setFieldsOpen] = useState(true);
  const [fieldStates, setFieldStates] = useState<boolean[]>(
    fields.map(() => true)
  );

  const updateEmbed = (updates: Partial<Embed>) => {
    onUpdate({ ...embed, ...updates });
  };

  // Sync fieldStates when fields change
  useEffect(() => {
    setFieldStates(fields.map(() => true));
  }, [fields.length]);

  const addField = () => {
    const newFields = [...fields, { name: "", value: "" }];
    setFields(newFields);
    updateEmbed({ fields: newFields });
    setFieldStates([...fieldStates, true]);
  };

  const updateField = (
    index: number,
    updates: Partial<{ name: string; value: string; inline?: boolean }>
  ) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFields(newFields);
    updateEmbed({ fields: newFields });
  };

  const removeField = (index: number) => {
    const newFields = fields.filter((_, i) => i !== index);
    setFields(newFields);
    updateEmbed({ fields: newFields });
    const newStates = fieldStates.filter((_, i) => i !== index);
    setFieldStates(newStates);
  };

  const embedTitle = embed.title || `Embed ${index + 1}`;

  return (
    <div className="border border-discord-hover rounded-lg overflow-hidden bg-discord-hover/50">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className="w-full px-4 py-2 flex items-center justify-between bg-discord-channel-sidebar hover:bg-discord-hover transition-colors"
      >
        <span className="text-sm font-semibold text-white">{embedTitle}</span>
        <div className="flex items-center gap-2">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            variant="ghost"
            size="sm"
            className="text-red-400 hover:text-red-300 hover:bg-red-500/20 h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-discord-text-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 text-discord-text-muted" />
          )}
        </div>
      </div>

      {isOpen && (
        <div className="p-4 space-y-3 bg-discord-channel-sidebar">
          {/* Author Section */}
          <div className="border border-discord-hover rounded overflow-hidden">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setAuthorOpen(!authorOpen)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setAuthorOpen(!authorOpen);
                }
              }}
              className="w-full px-4 py-2 flex items-center gap-2 bg-discord-hover hover:bg-discord-channel-sidebar transition-colors cursor-pointer"
            >
              <ChevronDown
                className={`h-4 w-4 text-discord-text-muted transition-transform flex-shrink-0 ${
                  authorOpen ? "" : "-rotate-90"
                }`}
              />
              <Label className="text-xs font-semibold text-discord-text-secondary uppercase cursor-pointer flex-1">
                Author
              </Label>
            </div>
            {authorOpen && (
              <div className="p-4 space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs text-discord-text-secondary">
                    Author
                  </Label>
                  <Input
                    value={embed.author?.name || ""}
                    onChange={(e) =>
                      updateEmbed({
                        author: { ...embed.author, name: e.target.value },
                      })
                    }
                    placeholder="Author name"
                    className="bg-discord-hover border-discord-hover text-white text-sm"
                    maxLength={256}
                  />
                  <div className="text-xs text-discord-text-muted text-right">
                    {(embed.author?.name || "").length}/256
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-discord-text-secondary">
                    Author URL
                  </Label>
                  <Input
                    value={embed.author?.url || ""}
                    onChange={(e) =>
                      updateEmbed({
                        author: { ...embed.author, url: e.target.value },
                      })
                    }
                    placeholder="https://..."
                    className="bg-discord-hover border-discord-hover text-white text-sm"
                    type="url"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-discord-text-secondary">
                    Author Icon URL
                  </Label>
                  <Input
                    value={embed.author?.icon_url || ""}
                    onChange={(e) =>
                      updateEmbed({
                        author: { ...embed.author, icon_url: e.target.value },
                      })
                    }
                    placeholder="https://..."
                    className="bg-discord-hover border-discord-hover text-white text-sm"
                    type="url"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Body Section */}
          <div className="border border-discord-hover rounded overflow-hidden">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setBodyOpen(!bodyOpen)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setBodyOpen(!bodyOpen);
                }
              }}
              className="w-full px-4 py-2 flex items-center gap-2 bg-discord-hover hover:bg-discord-channel-sidebar transition-colors cursor-pointer"
            >
              <ChevronDown
                className={`h-4 w-4 text-discord-text-muted transition-transform flex-shrink-0 ${
                  bodyOpen ? "" : "-rotate-90"
                }`}
              />
              <Label className="text-xs font-semibold text-discord-text-secondary uppercase cursor-pointer flex-1">
                Body
              </Label>
            </div>
            {bodyOpen && (
              <div className="p-4 space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs text-discord-text-secondary">
                    Title
                  </Label>
                  <Input
                    value={embed.title || ""}
                    onChange={(e) => updateEmbed({ title: e.target.value })}
                    placeholder="Embed title"
                    className="bg-discord-hover border-discord-hover text-white text-sm"
                    maxLength={256}
                  />
                  <div className="text-xs text-discord-text-muted text-right">
                    {(embed.title || "").length}/256
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-discord-text-secondary">
                    Description
                  </Label>
                  <Textarea
                    value={embed.description || ""}
                    onChange={(e) =>
                      updateEmbed({ description: e.target.value })
                    }
                    placeholder="Embed description"
                    className="bg-discord-hover border-discord-hover text-white text-sm min-h-[120px]"
                    maxLength={4096}
                  />
                  <div className="text-xs text-discord-text-muted text-right">
                    {(embed.description || "").length}/4096
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-discord-text-secondary">
                    URL
                  </Label>
                  <Input
                    value={embed.url || ""}
                    onChange={(e) => updateEmbed({ url: e.target.value })}
                    placeholder="https://..."
                    className="bg-discord-hover border-discord-hover text-white text-sm"
                    type="url"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-discord-text-secondary">
                    Color
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={embed.color || "#5865F2"}
                      onChange={(e) => updateEmbed({ color: e.target.value })}
                      className="w-16 h-9"
                    />
                    <Input
                      value={embed.color || ""}
                      onChange={(e) => updateEmbed({ color: e.target.value })}
                      placeholder="#5865F2"
                      className="bg-discord-hover border-discord-hover text-white text-sm flex-1"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Images Section */}
          <div className="border border-discord-hover rounded overflow-hidden">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setImagesOpen(!imagesOpen)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setImagesOpen(!imagesOpen);
                }
              }}
              className="w-full px-4 py-2 flex items-center gap-2 bg-discord-hover hover:bg-discord-channel-sidebar transition-colors cursor-pointer"
            >
              <ChevronDown
                className={`h-4 w-4 text-discord-text-muted transition-transform flex-shrink-0 ${
                  imagesOpen ? "" : "-rotate-90"
                }`}
              />
              <Label className="text-xs font-semibold text-discord-text-secondary uppercase cursor-pointer flex-1">
                Images
              </Label>
            </div>
            {imagesOpen && (
              <div className="p-4 space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs text-discord-text-secondary">
                    Image URL
                  </Label>
                  <Input
                    value={embed.image?.url || ""}
                    onChange={(e) =>
                      updateEmbed({ image: { url: e.target.value } })
                    }
                    placeholder="https://..."
                    className="bg-discord-hover border-discord-hover text-white text-sm"
                    type="url"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-discord-text-secondary">
                    Thumbnail URL
                  </Label>
                  <Input
                    value={embed.thumbnail?.url || ""}
                    onChange={(e) =>
                      updateEmbed({ thumbnail: { url: e.target.value } })
                    }
                    placeholder="https://..."
                    className="bg-discord-hover border-discord-hover text-white text-sm"
                    type="url"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Section */}
          <div className="border border-discord-hover rounded overflow-hidden">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setFooterOpen(!footerOpen)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setFooterOpen(!footerOpen);
                }
              }}
              className="w-full px-4 py-2 flex items-center gap-2 bg-discord-hover hover:bg-discord-channel-sidebar transition-colors cursor-pointer"
            >
              <ChevronDown
                className={`h-4 w-4 text-discord-text-muted transition-transform flex-shrink-0 ${
                  footerOpen ? "" : "-rotate-90"
                }`}
              />
              <Label className="text-xs font-semibold text-discord-text-secondary uppercase cursor-pointer flex-1">
                Footer
              </Label>
            </div>
            {footerOpen && (
              <div className="p-4 space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs text-discord-text-secondary">
                    Footer
                  </Label>
                  <Input
                    value={embed.footer?.text || ""}
                    onChange={(e) =>
                      updateEmbed({
                        footer: { ...embed.footer, text: e.target.value },
                      })
                    }
                    placeholder="Footer text"
                    className="bg-discord-hover border-discord-hover text-white text-sm"
                    maxLength={2048}
                  />
                  <div className="text-xs text-discord-text-muted text-right">
                    {(embed.footer?.text || "").length}/2048
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-discord-text-secondary">
                    Footer Icon URL
                  </Label>
                  <Input
                    value={embed.footer?.icon_url || ""}
                    onChange={(e) =>
                      updateEmbed({
                        footer: { ...embed.footer, icon_url: e.target.value },
                      })
                    }
                    placeholder="https://..."
                    className="bg-discord-hover border-discord-hover text-white text-sm"
                    type="url"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-discord-text-secondary">
                    Timestamp
                  </Label>
                  <Input
                    type="datetime-local"
                    value={
                      embed.timestamp
                        ? new Date(embed.timestamp).toISOString().slice(0, 16)
                        : ""
                    }
                    onChange={(e) =>
                      updateEmbed({
                        timestamp: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : undefined,
                      })
                    }
                    className="bg-discord-hover border-discord-hover text-white text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Fields Section */}
          <div className="border border-discord-hover rounded overflow-hidden">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setFieldsOpen(!fieldsOpen)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setFieldsOpen(!fieldsOpen);
                }
              }}
              className="w-full px-4 py-2 flex items-center gap-2 bg-discord-hover hover:bg-discord-channel-sidebar transition-colors cursor-pointer"
            >
              <ChevronDown
                className={`h-4 w-4 text-discord-text-muted transition-transform flex-shrink-0 ${
                  fieldsOpen ? "" : "-rotate-90"
                }`}
              />
              <Label className="text-xs font-semibold text-discord-text-secondary uppercase cursor-pointer flex-1">
                Fields {fields.length}/25
              </Label>
            </div>
            {fieldsOpen && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    onClick={addField}
                    disabled={fields.length >= 25}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-discord-blurple hover:text-discord-blurple/80"
                  >
                    + Add Field
                  </Button>
                  {fields.length > 0 && (
                    <Button
                      onClick={() => {
                        if (confirm("Clear all fields?")) {
                          setFields([]);
                          updateEmbed({ fields: [] });
                        }
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Clear Fields
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {fields.map((field, idx) => {
                    const fieldIsOpen =
                      fieldStates[idx] !== undefined ? fieldStates[idx] : true;
                    return (
                      <div
                        key={idx}
                        className="border border-discord-hover rounded overflow-hidden bg-discord-hover"
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            const newStates = [...fieldStates];
                            newStates[idx] = !fieldIsOpen;
                            setFieldStates(newStates);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              const newStates = [...fieldStates];
                              newStates[idx] = !fieldIsOpen;
                              setFieldStates(newStates);
                            }
                          }}
                          className="w-full px-3 py-2 flex items-center gap-2 hover:bg-discord-channel-sidebar transition-colors cursor-pointer"
                        >
                          <ChevronDown
                            className={`h-3 w-3 text-discord-text-muted transition-transform flex-shrink-0 ${
                              fieldIsOpen ? "" : "-rotate-90"
                            }`}
                          />
                          <span className="text-xs font-semibold text-white flex-1">
                            Field {idx + 1} - {field.name || "Unnamed"}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const fieldJson = JSON.stringify(field, null, 2);
                                navigator.clipboard.writeText(fieldJson);
                              }}
                              className="p-1 hover:bg-discord-hover rounded text-discord-text-muted hover:text-white"
                              title="Copy field"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeField(idx);
                              }}
                              variant="ghost"
                              size="sm"
                              className="text-xs text-red-400 hover:text-red-300 h-5 w-5 p-0"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {fieldIsOpen && (
                          <div className="p-3 space-y-2">
                            <div>
                              <Label className="text-xs text-discord-text-secondary">
                                Name
                              </Label>
                              <Input
                                placeholder="Field name"
                                value={field.name}
                                onChange={(e) =>
                                  updateField(idx, { name: e.target.value })
                                }
                                className="bg-discord-channel-sidebar border-discord-hover text-white text-xs"
                                maxLength={256}
                              />
                              <div className="text-xs text-discord-text-muted text-right mt-1">
                                {field.name.length}/256
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-discord-text-secondary">
                                Value
                              </Label>
                              <Textarea
                                placeholder="Field value"
                                value={field.value}
                                onChange={(e) =>
                                  updateField(idx, { value: e.target.value })
                                }
                                className="bg-discord-channel-sidebar border-discord-hover text-white text-xs min-h-[80px]"
                                maxLength={1024}
                              />
                              <div className="text-xs text-discord-text-muted text-right mt-1">
                                {field.value.length}/1024
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs flex items-center gap-2 text-discord-text-secondary">
                                <input
                                  type="checkbox"
                                  checked={field.inline || false}
                                  onChange={(e) =>
                                    updateField(idx, { inline: e.target.checked })
                                  }
                                  className="rounded"
                                />
                                Inline
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {fields.length === 0 && (
                    <div className="text-center py-8 text-discord-text-muted text-sm">
                      No fields yet. Click "Add Field" to create one.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

