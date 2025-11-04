"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { EditorSidebar } from "@/components/EditorSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit, Trash2, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Template {
  id: string;
  name: string;
  content: string | null;
  embed_data: any;
  settings_data: any;
  message_data: any;
  created_at: string;
  updated_at: string;
}

export function SavedMessagesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/templates");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const response = await fetch(`/api/templates?id=${templateId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTemplates(templates.filter((t) => t.id !== templateId));
      }
    } catch (error) {
      console.error("Failed to delete template:", error);
    }
  };

  const handleLoad = (templateId: string) => {
    router.push(`/protected/editor?template_id=${templateId}`);
  };

  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-screen flex bg-discord-message-area overflow-hidden">
      <EditorSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-discord-hover bg-discord-channel-sidebar">
          <h1 className="font-semibold text-white">Saved Templates</h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Search */}
          <div className="mb-4">
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-discord-channel-sidebar border-discord-hover text-white"
            />
          </div>

          {/* Templates List */}
          {loading ? (
            <div className="text-center py-12 text-discord-text-muted">
              Loading...
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12 text-discord-text-muted">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">
                {searchQuery ? "No templates found" : "No saved templates yet"}
              </p>
              <p className="text-sm">
                {searchQuery
                  ? "Try a different search query"
                  : "Save templates from the Message Editor to see them here"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="bg-discord-channel-sidebar border border-discord-hover rounded-lg p-4 hover:bg-discord-hover transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-2">
                        {template.name}
                      </h3>
                      {(() => {
                        // Use message_data if available, otherwise fallback to legacy fields
                        const md = template.message_data;
                        const displayContent = md?.content || template.content;
                        const displayEmbeds = md?.embeds || (template.embed_data ? [template.embed_data] : null);

                        return (
                          <>
                            {displayContent && (
                              <p className="text-sm text-discord-text-secondary mb-2 line-clamp-2">
                                {displayContent}
                              </p>
                            )}
                            {displayEmbeds && displayEmbeds.length > 0 && (
                              <div className="text-xs text-discord-text-muted mb-2 flex flex-wrap gap-1">
                                {displayEmbeds.slice(0, 2).map((embed: any, idx: number) => (
                                  embed.title && (
                                    <span key={idx} className="bg-discord-hover px-2 py-1 rounded">
                                      Embed: {embed.title}
                                    </span>
                                  )
                                ))}
                                {displayEmbeds.length > 2 && (
                                  <span className="bg-discord-hover px-2 py-1 rounded">
                                    +{displayEmbeds.length - 2} more
                                  </span>
                                )}
                              </div>
                            )}
                            {md?.components && md.components.length > 0 && (
                              <div className="text-xs text-discord-text-muted mb-2">
                                <span className="bg-discord-hover px-2 py-1 rounded">
                                  Components: {md.components.length}
                                </span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                      <div className="text-xs text-discord-text-muted">
                        Updated{" "}
                        {formatDistanceToNow(new Date(template.updated_at || template.created_at), {
                          addSuffix: true,
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLoad(template.id)}
                        className="text-discord-text-muted hover:text-white"
                        title="Load Template"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(template.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

