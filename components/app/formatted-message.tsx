"use client";

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function FormattedMessage({ content }: { content: string }) {
  const formatted = content
    // Code blocks
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, lang, code) =>
      `<pre><code class="lang-${escapeHtml(lang)}">${escapeHtml(code.trim())}</code></pre>`
    )
    // Inline code
    .replace(/`([^`]+)`/g, (_m, code) => `<code>${escapeHtml(code)}</code>`)
    // Bold
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    // Headers
    .replace(/^### (.+)$/gm, "<strong style=\"font-size:13px;color:var(--brand-strong)\">$1</strong>")
    .replace(/^## (.+)$/gm, "<strong style=\"font-size:14px;color:var(--text)\">$1</strong>")
    .replace(/^# (.+)$/gm, "<strong style=\"font-size:15px;color:var(--text)\">$1</strong>")
    // Unordered lists
    .replace(/^[•\-\*] (.+)$/gm, "<span style=\"display:block;padding-left:14px\">• $1</span>")
    // Numbered lists
    .replace(/^(\d+)\. (.+)$/gm, "<span style=\"display:block;padding-left:14px\">$1. $2</span>")
    // Line breaks (not inside pre)
    .replace(/\n/g, "<br>");

  return (
    <div
      style={{ whiteSpace: "normal", wordBreak: "break-word" }}
      dangerouslySetInnerHTML={{ __html: formatted }}
    />
  );
}
