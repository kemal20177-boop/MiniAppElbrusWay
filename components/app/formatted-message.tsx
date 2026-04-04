"use client";

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function FormattedMessage({ content }: { content: string }) {
  const codeBlocks: string[] = [];
  const withPlaceholders = content.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
    const index =
      codeBlocks.push(`<pre><code class="lang-${escapeHtml(lang)}">${escapeHtml(code.trim())}</code></pre>`) - 1;
    return `@@CODEBLOCK_${index}@@`;
  });

  const safe = escapeHtml(withPlaceholders);

  const formatted = safe
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, '<strong style="font-size:13px;color:var(--brand-strong)">$1</strong>')
    .replace(/^## (.+)$/gm, '<strong style="font-size:14px;color:var(--text)">$1</strong>')
    .replace(/^# (.+)$/gm, '<strong style="font-size:15px;color:var(--text)">$1</strong>')
    .replace(/^[-*•] (.+)$/gm, '<span style="display:block;padding-left:14px">• $1</span>')
    .replace(/^(\d+)\. (.+)$/gm, '<span style="display:block;padding-left:14px">$1. $2</span>')
    .replace(/\n/g, "<br>");

  const withCodeBlocks = formatted.replace(/@@CODEBLOCK_(\d+)@@/g, (_match, index) => codeBlocks[Number(index)] || "");

  return (
    <div
      style={{ whiteSpace: "normal", wordBreak: "break-word" }}
      dangerouslySetInnerHTML={{ __html: withCodeBlocks }}
    />
  );
}
