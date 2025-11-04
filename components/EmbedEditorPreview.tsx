"use client";

interface Embed {
  title?: string;
  description?: string;
  color?: string | number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  author?: { name?: string; icon_url?: string; url?: string };
  footer?: { text?: string; icon_url?: string };
  thumbnail?: { url: string };
  image?: { url: string };
  timestamp?: string;
}

interface Component {
  type: number;
  components: any[];
}

interface EmbedEditorPreviewProps {
  content: string;
  embeds: Embed[];
  attachments: File[];
  components: Component[];
}

export function EmbedEditorPreview({
  content,
  embeds,
  attachments,
  components,
}: EmbedEditorPreviewProps) {
  // Import markdown converter lazily for client-side rendering
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const { toHTML } = require("@/lib/discord/markdown") as typeof import(
    "@/lib/discord/markdown"
  );
  const formatTime = () => {
    const now = new Date();
    return `Today at ${now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  };

  const renderEmbed = (embed: Embed, index: number) => {
    if (!embed || (!embed.title && !embed.description && !embed.fields?.length))
      return null;

    let borderColor = "#5865F2";
    if (embed.color) {
      if (typeof embed.color === "string") {
        borderColor = embed.color.startsWith("#")
          ? embed.color
          : `#${embed.color}`;
      } else {
        borderColor = `#${embed.color.toString(16).padStart(6, "0")}`;
      }
    }

    return (
      <div
        key={index}
        className="rounded-lg border-l-4 p-3 text-sm mt-2"
        style={{
          borderLeftColor: borderColor,
          backgroundColor: "#2F3136",
        }}
      >
        {embed.author && (
          <div className="flex items-center gap-2 mb-2">
            {embed.author.icon_url && (
              <img
                src={embed.author.icon_url}
                alt=""
                className="w-5 h-5 rounded-full"
              />
            )}
            {embed.author.url ? (
              <a
                href={embed.author.url}
                className="font-semibold text-white hover:underline"
              >
                {embed.author.name}
              </a>
            ) : (
              <span className="font-semibold text-white">
                {embed.author.name}
              </span>
            )}
          </div>
        )}

        {embed.title && (
          <div className="font-semibold mb-1 text-white text-base">
            {embed.title}
          </div>
        )}

        {embed.description && (
          <div
            className="text-discord-text-secondary mb-2 whitespace-pre-wrap discord-markup"
            dangerouslySetInnerHTML={{ __html: toHTML(embed.description) }}
          />
        )}

        {embed.thumbnail?.url && (
          <img
            src={embed.thumbnail.url}
            alt="Thumbnail"
            className="rounded float-right ml-2 mb-2 max-w-[80px] max-h-[80px]"
          />
        )}

        {embed.image?.url && (
          <img
            src={embed.image.url}
            alt="Embed image"
            className="rounded mt-2 max-w-full"
          />
        )}

        {embed.fields && embed.fields.length > 0 && (
          <div className="mt-2">
            <div
              className={
                embed.fields.some((f) => f.inline)
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
                  : "space-y-1"
              }
            >
              {embed.fields
                .filter((f) => f.name && f.value)
                .map((field, idx) => (
                  <div key={idx} className="text-sm">
                    <span className="font-semibold text-white block">
                      {field.name}
                    </span>
                    <div
                      className="text-discord-text-secondary whitespace-pre-wrap discord-markup"
                      dangerouslySetInnerHTML={{ __html: toHTML(field.value) }}
                    />
                  </div>
                ))}
            </div>
          </div>
        )}

        {(embed.footer?.text || embed.footer?.icon_url || embed.timestamp) && (
          <div className="flex items-center gap-1 mt-2 text-xs text-discord-text-muted">
            {embed.footer?.icon_url && (
              <img
                src={embed.footer.icon_url}
                alt=""
                className="w-4 h-4 rounded"
              />
            )}
            {embed.footer?.text && <span>{embed.footer.text}</span>}
            {embed.timestamp && (embed.footer?.text || embed.footer?.icon_url) && (
              <span>•</span>
            )}
            {embed.timestamp && (
              <span>{new Date(embed.timestamp).toLocaleString()}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderComponents = () => {
    if (!components || components.length === 0) return null;

    return (
      <div className="mt-2 space-y-2">
        {components.map((component, idx) => {
          if (component.type === 1 && component.components) {
            // Action Row
            return (
              <div key={idx} className="flex gap-2 flex-wrap">
                {component.components.map((comp: any, compIdx: number) => {
                  if (comp.type === 2) {
                    // Button
                    const style =
                      comp.style === 1
                        ? "bg-discord-blurple hover:bg-discord-blurple/90"
                        : comp.style === 2
                        ? "bg-green-600 hover:bg-green-700"
                        : comp.style === 3
                        ? "bg-gray-600 hover:bg-gray-700"
                        : comp.style === 4
                        ? "bg-red-600 hover:bg-red-700"
                        : comp.style === 5
                        ? "bg-discord-blurple hover:bg-discord-blurple/90"
                        : "bg-discord-hover hover:bg-discord-channel-sidebar";
                    return (
                      <button
                        key={compIdx}
                        disabled={comp.disabled}
                        className={`px-4 py-2 rounded text-sm font-medium text-white ${style} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {comp.emoji && <span>{comp.emoji.name}</span>}{" "}
                        {comp.label}
                      </button>
                    );
                  }
                  return null;
                })}
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-discord-message-area">
      {/* Preview Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-discord-hover bg-discord-channel-sidebar">
        <h2 className="font-semibold text-white text-sm uppercase">
          Live Preview
        </h2>
      </div>

      {/* Preview Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-discord-message-area space-y-4">
          {/* Message Preview */}
          <div className="group hover:bg-discord-hover/30 rounded px-2 py-1 -mx-2 transition-colors">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 bg-discord-blurple">
                W
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-semibold text-white text-sm">
                    Webhook
                  </span>
                  <span className="text-discord-text-muted text-xs">
                    {formatTime()}
                  </span>
                </div>

                {/* Message Content */}
                {content && (
                  <div
                    className="text-discord-text-primary text-sm whitespace-pre-wrap mb-2 discord-markup"
                    dangerouslySetInnerHTML={{ __html: toHTML(content) }}
                  />
                )}

                {/* Embeds */}
                {embeds.map((embed, index) => renderEmbed(embed, index))}

                {/* Attachments Preview */}
                {attachments.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {attachments.map((file, idx) => (
                      <div
                        key={idx}
                        className="text-sm text-discord-text-secondary bg-discord-hover p-2 rounded"
                      >
                        📎 {file.name} ({(file.size / 1024).toFixed(2)} KB)
                      </div>
                    ))}
                  </div>
                )}

                {/* Components Preview */}
                {renderComponents()}
              </div>
            </div>
          </div>

          {/* Empty State */}
          {!content && embeds.length === 0 && attachments.length === 0 && (
            <div className="text-center py-12 text-discord-text-muted">
              <p className="text-sm">Your message preview will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

