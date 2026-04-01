"use client";

import { DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { defaultModelId } from "@/lib/site";

type ChatSummary = {
  id: string;
  title: string;
  model: string;
  updatedAt: string;
  projectId?: string | null;
  isPinned?: boolean;
};

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: Array<{ id: string; originalName: string }>;
};

type ModelOption = {
  id: string;
  name: string;
  provider: string;
  supportsFiles: boolean;
  supportsWebSearch: boolean;
  pricing: {
    prompt?: number;
    completion?: number;
  } | null;
};

type ProjectOption = {
  id: string;
  title: string;
};

type UserFileItem = {
  id: string;
  originalName: string;
  kind: string;
};

type ToolEvent = {
  id: string;
  toolName: string;
  status: string;
  output?: Record<string, unknown>;
};

type CanvasRecord = {
  id: string;
  title: string;
  currentContent: string;
  versions?: Array<{ version: number; content: string }>;
};

function formatPricePerMillion(value?: number) {
  if (typeof value !== "number") {
    return "n/a";
  }
  return `${(value * 1_000_000).toFixed(2)} ₽`;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderMessageHtml(content: string) {
  const fenced = content.replace(/```([\s\S]*?)```/g, (_, block) => `<pre><code>${escapeHtml(String(block).trim())}</code></pre>`);
  return fenced
    .split("\n")
    .map((line) => {
      if (line.startsWith("### ")) return `<h3>${escapeHtml(line.slice(4))}</h3>`;
      if (line.startsWith("## ")) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
      if (line.startsWith("# ")) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join("");
}

export default function ChatPage() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [files, setFiles] = useState<UserFileItem[]>([]);
  const [selectedModel, setSelectedModel] = useState(defaultModelId);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [chatId, setChatId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [useProjectContext, setUseProjectContext] = useState(true);
  const [chatQuery, setChatQuery] = useState("");
  const [splitCanvas, setSplitCanvas] = useState<CanvasRecord | null>(null);
  const [canvasStatus, setCanvasStatus] = useState("");
  const [canvasSelection, setCanvasSelection] = useState("");
  const [rollbackVersion, setRollbackVersion] = useState("");

  useEffect(() => {
    void Promise.all([loadModels(), loadChats(), loadProjects(), loadFiles(), loadProfile()]);
  }, []);

  useEffect(() => {
    if (!splitCanvas?.id) {
      return;
    }

    setCanvasStatus("Autosaving...");
    const timer = setTimeout(async () => {
      const response = await fetch(`/api/canvas/${splitCanvas.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "autosave",
          content: splitCanvas.currentContent
        })
      });
      const payload = await response.json();
      if (response.ok) {
        setSplitCanvas(payload.data.canvas);
        setCanvasStatus("Saved");
      } else {
        setCanvasStatus(payload.error?.message || "Autosave failed");
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [splitCanvas?.currentContent, splitCanvas?.id]);

  async function loadModels() {
    const response = await fetch("/api/models");
    const payload = await response.json();
    if (response.ok && Array.isArray(payload.data)) {
      setModels(payload.data);
      if (!payload.data.some((entry: ModelOption) => entry.id === selectedModel) && payload.data[0]?.id) {
        setSelectedModel(payload.data[0].id);
      }
    }
  }

  async function loadChats(query = chatQuery) {
    const response = await fetch(`/api/chats?query=${encodeURIComponent(query)}`);
    const payload = await response.json();
    if (!response.ok) {
      setError("Нужна авторизация для работы с чатами");
      return;
    }
    setChats(payload.data?.chats || []);
  }

  async function loadProjects() {
    const response = await fetch("/api/projects");
    const payload = await response.json();
    if (response.ok) {
      setProjects(payload.data.projects || []);
    }
  }

  async function loadFiles() {
    const response = await fetch("/api/files");
    const payload = await response.json();
    if (response.ok) {
      setFiles(payload.data.files || []);
    }
  }

  async function loadProfile() {
    const response = await fetch("/api/user/profile");
    const payload = await response.json();
    if (response.ok) {
      setTokenBalance(payload.user.tokenBalance);
    }
  }

  async function uploadComposerFiles(fileList: FileList | File[]) {
    const formData = new FormData();
    Array.from(fileList).forEach((file) => formData.append("files", file));
    const response = await fetch("/api/files", { method: "POST", body: formData });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось загрузить файлы");
      return;
    }
    const uploaded = payload.data.files || [];
    setSelectedFiles((prev) => [...new Set([...prev, ...uploaded.map((file: UserFileItem) => file.id)])]);
    await loadFiles();
  }

  async function openChat(nextChatId: string) {
    const response = await fetch(`/api/chats/${nextChatId}/messages`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.message || "Не удалось открыть чат");
      return;
    }

    setChatId(nextChatId);
    setSelectedProjectId(payload.chat.projectId || "");
    setMessages(
      (payload.messages || []).map((entry: { role: ChatMessage["role"]; content: string; attachments?: Array<{ file: { id: string; originalName: string } }> }) => ({
        role: entry.role,
        content: entry.content,
        attachments: (entry.attachments || []).map((attachment) => ({
          id: attachment.file.id,
          originalName: attachment.file.originalName
        }))
      }))
    );
    setToolEvents(payload.toolCalls || []);
  }

  async function createChat() {
    const response = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: selectedModel,
        projectId: selectedProjectId || undefined
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.message || "Не удалось создать чат");
      return;
    }

    setChatId(payload.data.chat.id);
    setMessages([]);
    setToolEvents([]);
    await loadChats();
  }

  async function patchChat(nextId: string, body: Record<string, unknown>) {
    const response = await fetch(`/api/chats/${nextId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (response.ok) {
      await loadChats();
    }
  }

  async function deleteChat(nextId: string) {
    const response = await fetch(`/api/chats/${nextId}`, { method: "DELETE" });
    if (response.ok) {
      if (chatId === nextId) {
        setChatId(undefined);
        setMessages([]);
        setToolEvents([]);
      }
      await loadChats();
    }
  }

  async function createCanvasFromMessage(content: string) {
    const response = await fetch("/api/canvas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Canvas from chat",
        content,
        projectId: selectedProjectId || undefined
      })
    });
    const payload = await response.json();
    if (response.ok) {
      setSplitCanvas(payload.data.canvas);
      setRollbackVersion("");
      setCanvasStatus("Ready");
    }
  }

  async function patchSplitCanvas(body: Record<string, unknown>) {
    if (!splitCanvas) {
      return;
    }
    const response = await fetch(`/api/canvas/${splitCanvas.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (response.ok) {
      setSplitCanvas(payload.data.canvas);
      setCanvasStatus("Updated");
    } else {
      setError(payload.error?.message || "Не удалось обновить canvas");
    }
  }

  async function createDocumentFromMessage(content: string) {
    await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Document from chat",
        prompt: content,
        projectId: selectedProjectId || undefined,
        sourceChatId: chatId
      })
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>, overrideInput?: string) {
    event.preventDefault();
    const draft = (overrideInput || input).trim();
    if (!draft || loading) {
      return;
    }

    const attachedFiles = files.filter((file) => selectedFiles.includes(file.id));
    const previousMessages = messages;
    const nextMessages = [
      ...messages,
      {
        role: "user" as const,
        content: draft,
        attachments: attachedFiles.map((file) => ({
          id: file.id,
          originalName: file.originalName
        }))
      },
      { role: "assistant" as const, content: "" }
    ];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");
    setToolEvents([]);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          projectId: selectedProjectId || undefined,
          model: selectedModel,
          attachmentIds: selectedFiles,
          tools: {
            webSearch: useWebSearch,
            projectContext: useProjectContext
          },
          messages: nextMessages
            .filter((entry) => !(entry.role === "assistant" && !entry.content))
            .map((entry) => ({
              role: entry.role,
              content: entry.content
            }))
        })
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.message || "Не удалось получить ответ");
      }
      if (!response.body) {
        throw new Error("STREAM_NOT_AVAILABLE");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamedContent = "";
      let finalChatId = chatId;
      let finalTokenBalance = tokenBalance;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let boundaryIndex = buffer.indexOf("\n\n");

        while (boundaryIndex !== -1) {
          const block = buffer.slice(0, boundaryIndex);
          buffer = buffer.slice(boundaryIndex + 2);
          boundaryIndex = buffer.indexOf("\n\n");
          const eventType = block.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
          const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
          if (!eventType || !dataLine) continue;
          const payload = JSON.parse(dataLine.slice(5).trim()) as Record<string, unknown>;
          if (eventType === "meta") finalChatId = typeof payload.chatId === "string" ? payload.chatId : finalChatId;
          if (eventType === "tool") setToolEvents((prev) => [...prev, payload as unknown as ToolEvent]);
          if (eventType === "delta") {
            streamedContent += String(payload.content || "");
            setMessages((prev) => {
              const copy = [...prev];
              copy[copy.length - 1] = { role: "assistant", content: streamedContent };
              return copy;
            });
          }
          if (eventType === "done") {
            finalChatId = typeof payload.chatId === "string" ? payload.chatId : finalChatId;
            finalTokenBalance = typeof payload.tokenBalance === "number" ? payload.tokenBalance : finalTokenBalance;
          }
          if (eventType === "error") throw new Error(String(payload.message || "STREAM_FAILED"));
        }
      }

      setChatId(finalChatId);
      setSelectedFiles([]);
      if (typeof finalTokenBalance === "number") setTokenBalance(finalTokenBalance);
      await loadChats();
    } catch (nextError) {
      setMessages(previousMessages);
      setError((nextError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const activeModel = models.find((entry) => entry.id === selectedModel);
  const filteredChats = useMemo(() => chats, [chats]);

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (event.dataTransfer.files?.length) {
      void uploadComposerFiles(event.dataTransfer.files);
    }
  }

  return (
    <main className="workspace-page">
      <section className="panel workspace-panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div>
            <div className="badge">Chat Core 3.0</div>
            <h1 className="section-title" style={{ marginTop: 16 }}>Чат, файлы, проекты и canvas</h1>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span className="badge">Баланс: {tokenBalance ?? "..."}</span>
            <span className="badge">{activeModel?.name || selectedModel}</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: splitCanvas ? "280px minmax(0, 1fr) 420px" : "280px minmax(0, 1fr) 340px", gap: 20, marginTop: 24 }}>
          <aside className="card" style={{ display: "grid", gap: 12, alignContent: "start" }}>
            <button className="button-primary" type="button" onClick={() => void createChat()}>Новый чат</button>
            <input value={chatQuery} onChange={(event) => { setChatQuery(event.target.value); void loadChats(event.target.value); }} placeholder="Поиск по чатам" style={{ width: "100%", minHeight: 42, borderRadius: 12, padding: "0 12px", border: "1px solid var(--border)", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)" }} />
            {filteredChats.map((chat) => (
              <div key={chat.id} className="card" style={{ padding: 14, background: chat.id === chatId ? "rgba(30,111,217,0.18)" : "rgba(255,255,255,0.03)" }}>
                <button type="button" onClick={() => void openChat(chat.id)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}>
                  <div style={{ fontWeight: 700 }}>{chat.isPinned ? "📌 " : ""}{chat.title}</div>
                  <div className="muted" style={{ marginTop: 6 }}>{new Date(chat.updatedAt).toLocaleString("ru-RU")}</div>
                </button>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button className="button-secondary" type="button" onClick={() => { const title = prompt("Новое имя чата", chat.title); if (title) void patchChat(chat.id, { title }); }}>Rename</button>
                  <button className="button-secondary" type="button" onClick={() => void patchChat(chat.id, { isPinned: !chat.isPinned })}>{chat.isPinned ? "Unpin" : "Pin"}</button>
                  <button className="button-ghost" type="button" onClick={() => void deleteChat(chat.id)}>Delete</button>
                </div>
              </div>
            ))}
          </aside>

          <section className="card" style={{ display: "grid", gridTemplateRows: "1fr auto", minHeight: 720 }}>
            <div style={{ display: "grid", gap: 12, alignContent: "start", paddingBottom: 20, overflow: "auto" }}>
              {messages.length === 0 ? <div className="muted">Выбери чат или отправь первое сообщение.</div> : null}
              {messages.map((message, index) => (
                <article key={`${message.role}-${index}`} style={{ justifySelf: message.role === "user" ? "end" : "start", maxWidth: "92%", padding: "16px 18px", borderRadius: 18, background: message.role === "user" ? "linear-gradient(135deg, rgba(30,111,217,0.9), rgba(0,200,232,0.65))" : "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div dangerouslySetInnerHTML={{ __html: renderMessageHtml(message.content) }} />
                  {message.attachments?.length ? <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>Вложения: {message.attachments.map((attachment) => attachment.originalName).join(", ")}</div> : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <button className="button-secondary" type="button" onClick={() => void navigator.clipboard.writeText(message.content)}>Copy</button>
                    {message.role === "user" ? <button className="button-secondary" type="button" onClick={() => setInput(message.content)}>Edit & resend</button> : null}
                    {message.role === "assistant" ? <button className="button-secondary" type="button" onClick={() => void createCanvasFromMessage(message.content)}>Open in canvas</button> : null}
                    {message.role === "assistant" ? <button className="button-secondary" type="button" onClick={() => void createDocumentFromMessage(message.content)}>Create document</button> : null}
                    {message.role === "assistant" && index >= 1 ? <button className="button-secondary" type="button" onClick={(event) => void onSubmit(event as unknown as FormEvent<HTMLFormElement>, messages[index - 1]?.content || "")}>Regenerate</button> : null}
                  </div>
                </article>
              ))}
            </div>

            <form onSubmit={(event) => void onSubmit(event)} style={{ display: "grid", gap: 12, position: "sticky", bottom: 0, background: "rgba(11,16,22,0.95)", paddingTop: 8 }} onDrop={onDrop} onDragOver={(event) => event.preventDefault()}>
              <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={5} placeholder="Напиши сообщение или перетащи файлы сюда..." style={{ width: "100%", resize: "vertical", borderRadius: 18, padding: 16, background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label className="button-secondary" style={{ cursor: "pointer" }}>
                  Upload
                  <input hidden multiple type="file" onChange={(event) => { if (event.target.files?.length) void uploadComposerFiles(event.target.files); }} />
                </label>
                {selectedFiles.map((fileId) => {
                  const file = files.find((entry) => entry.id === fileId);
                  return file ? <span key={file.id} className="badge">{file.originalName}</span> : null;
                })}
              </div>
              {error ? <div style={{ color: "var(--error)" }}>{error}</div> : null}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div className="muted">In: {formatPricePerMillion(activeModel?.pricing?.prompt)} · Out: {formatPricePerMillion(activeModel?.pricing?.completion)}</div>
                <button className="button-primary" type="submit" disabled={loading || !activeModel}>{loading ? "Генерация..." : "Отправить"}</button>
              </div>
            </form>
          </section>

          <aside className="card" style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <h2 style={{ margin: 0 }}>Контекст</h2>
            <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} style={{ width: "100%", minHeight: 44, borderRadius: 14, padding: "0 12px", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              <option value="">Без проекта</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
            <select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} style={{ width: "100%", minHeight: 44, borderRadius: 14, padding: "0 12px", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              {models.map((model) => <option key={model.id} value={model.id}>{model.provider} · {model.name}</option>)}
            </select>
            <div style={{ display: "grid", gap: 8, maxHeight: 180, overflow: "auto" }}>
              {files.map((file) => (
                <label key={file.id} className="card" style={{ padding: 12, display: "flex", gap: 10, alignItems: "center" }}>
                  <input type="checkbox" checked={selectedFiles.includes(file.id)} onChange={(event) => setSelectedFiles((prev) => event.target.checked ? [...prev, file.id] : prev.filter((entry) => entry !== file.id))} />
                  <span>{file.originalName}</span>
                </label>
              ))}
            </div>
            <label className="card" style={{ padding: 14, display: "flex", gap: 10, alignItems: "center" }}>
              <input type="checkbox" checked={useProjectContext} onChange={(event) => setUseProjectContext(event.target.checked)} />
              <span>Project context</span>
            </label>
            <label className="card" style={{ padding: 14, display: "flex", gap: 10, alignItems: "center" }}>
              <input type="checkbox" checked={useWebSearch} onChange={(event) => setUseWebSearch(event.target.checked)} />
              <span>Web search</span>
            </label>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Tool events</div>
              <div style={{ display: "grid", gap: 8 }}>
                {toolEvents.map((event) => (
                  <div key={event.id} className="card" style={{ padding: 10 }}>
                    <div style={{ fontWeight: 700 }}>{event.toolName}</div>
                    <div className="muted" style={{ marginTop: 4 }}>{event.status}</div>
                    {event.output ? <pre style={{ whiteSpace: "pre-wrap", overflow: "auto", marginTop: 8 }}>{JSON.stringify(event.output, null, 2)}</pre> : null}
                  </div>
                ))}
                {toolEvents.length === 0 ? <div className="muted">Tool events появятся здесь.</div> : null}
              </div>
            </div>
            {splitCanvas ? (
              <div className="card" style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div style={{ fontWeight: 700 }}>{splitCanvas.title}</div>
                  <div className="muted">{canvasStatus || "Ready"}</div>
                </div>
                <textarea
                  value={splitCanvas.currentContent}
                  onChange={(event) => setSplitCanvas((current) => current ? { ...current, currentContent: event.target.value } : current)}
                  rows={18}
                  style={{ width: "100%", marginTop: 12, borderRadius: 14, padding: 14, background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                />
                <textarea
                  value={canvasSelection}
                  onChange={(event) => setCanvasSelection(event.target.value)}
                  rows={4}
                  placeholder="Selected fragment for rewrite"
                  style={{ width: "100%", borderRadius: 14, padding: 14, background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(["improve", "shorten", "translate", "explain", "refactor"] as const).map((rewriteAction) => (
                    <button key={rewriteAction} className="button-secondary" type="button" onClick={() => void patchSplitCanvas({ mode: "rewrite", selection: canvasSelection || undefined, action: rewriteAction })}>
                      {rewriteAction}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <select value={rollbackVersion} onChange={(event) => setRollbackVersion(event.target.value)} style={{ minHeight: 42, borderRadius: 12, padding: "0 12px", border: "1px solid var(--border)", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)" }}>
                    <option value="">Rollback version</option>
                    {(splitCanvas.versions || []).map((version) => <option key={version.version} value={String(version.version)}>v{version.version}</option>)}
                  </select>
                  <button className="button-secondary" type="button" disabled={!rollbackVersion} onClick={() => void patchSplitCanvas({ mode: "rollback", version: Number(rollbackVersion) })}>Rollback</button>
                  <a className="button-secondary" href={`/canvas/${splitCanvas.id}`}>Open full canvas</a>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}
