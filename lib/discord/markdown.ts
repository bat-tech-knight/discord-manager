// A minimal Discord-like markdown to HTML converter using simple-markdown
// Mirrors embed-generator's approach but scoped to bold, italic, underline,
// strikethrough, links, inline code, and fenced code blocks.

import markdown from "simple-markdown";

// Build rules: start with defaults and tweak output to be safe for preview
const rules = {
  ...markdown.defaultRules,
  // Ensure we open links in a new tab and sanitize href
  link: {
    ...markdown.defaultRules.link,
    html: (node: any, output: any, state: any) => {
      const attributes = {
        href: markdown.sanitizeUrl(node.target),
        title: node.title,
        target: "_blank",
        rel: "noreferrer noopener",
      } as Record<string, string>;
      return markdown.htmlTag(
        "a",
        output(node.content, state),
        attributes,
        state
      );
    },
  },
  autolink: {
    ...markdown.defaultRules.autolink,
    html: (node: any, output: any, state: any) =>
      markdown.htmlTag(
        "a",
        output(node.content, state),
        {
          href: markdown.sanitizeUrl(node.target),
          target: "_blank",
          rel: "noreferrer noopener",
        },
        state
      ),
  },
  url: {
    ...markdown.defaultRules.url,
    html: (node: any, output: any, state: any) =>
      markdown.htmlTag(
        "a",
        output(node.content, state),
        {
          href: markdown.sanitizeUrl(node.target),
          target: "_blank",
          rel: "noreferrer noopener",
        },
        state
      ),
  },
  // Keep inline code simple; Discord renders with a subtle bg
  inlineCode: {
    ...markdown.defaultRules.inlineCode,
    html: (node: any, _output: any, state: any) =>
      markdown.htmlTag(
        "code",
        markdown.sanitizeText(node.content.trim()),
        {},
        state
      ),
  },
  // Fenced code blocks
  codeBlock: {
    ...markdown.defaultRules.codeBlock,
    html: (node: any, _output: any, state: any) =>
      markdown.htmlTag(
        "pre",
        markdown.htmlTag(
          "code",
          markdown.sanitizeText(node.content),
          {},
          state
        ),
        {},
        state
      ),
  },
};

const parser = markdown.parserFor(rules as any);
const htmlOutput = markdown.outputFor(rules as any, "html" as any);

export function toHTML(source: string): string {
  const state = {
    inline: true,
    inQuote: false,
    inEmphasis: false,
    escapeHTML: true,
  } as any;

  try {
    return htmlOutput(parser(source || "", state), state);
  } catch {
    // In case of parsing error, fall back to sanitized text
    return markdown.sanitizeText(source || "");
  }
}

export default toHTML;


