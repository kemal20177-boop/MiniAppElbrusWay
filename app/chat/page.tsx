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

function presentCanvasStatus(value: string) {
  if (!value) return "Готово";
  if (value === "Autosaving...") return "Сохраняем";
  if (value === "Saved") return "Сохранено";
  if (value === "Updated") return "Обновлено";
  if (value === "Autosave failed") return "Не удалось сохранить";
  return value;
}

function presentToolName(value: string) {
  const normalized = value.replace(/[_-]/g, " ");
  if (normalized.includes("search")) return "Поиск";
  if (normalized.includes("vision")) return "Анализ изображений";
  if (normalized.includes("image")) return "Изображения";
  if (normalized.includes("audio")) return "Аудио";
  if (normalized.includes("document")) return "Документы";
  if (normalized.includes("file")) return "Файлы";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function presentToolStatus(value: string) {
  if (value === "PENDING") return "В очереди";
  if (value === "RUNNING") return "В обработке";
  if (value === "SUCCEEDED") return "Готово";
  if (value === "FAILED") return "Ошибка";
  if (value === "CANCELLED") return "Остановлено";
  return value;
}

function rewriteActionLabel(value: "improve" | "shorten" | "translate" | "explain" | "refactor") {
  if (value === "improve") return "Улучшить";
  if (value === "shorten") return "Сократить";
  if (value === "translate") return "Перевести";
  if (value === "explain") return "Объяснить";
  return "Переработать";
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
        title: "Канвас из чата",
        content,
        projectId: selectedProjectId || undefined
      })
    });
    const payload = await response.json();
    if (response.ok) {
      setSplitCanvas(payload.data.canvas);
      setRollbackVersion("");
      setCanvasStatus("Готово");
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
      setError(payload.error?.message || "Не удалось обновить редактор");
    }
  }

  async function createDocumentFromMessage(content: string) {
    await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Документ из ответа",
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
            <div className="badge">Чат</div>
            <h1 className="section-title" style={{ marginTop: 16 }}>Диалоги, файлы и редактор в одном окне</h1>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span className="badge">Баланс: {tokenBalance ?? "..."}</span>
            <span className="badge">{activeModel?.name || "Модель"}</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "290px minmax(0, 1fr)", gap: 24, marginTop: 28, alignItems: "start" }}>
          <aside className="card" style={{ display: "grid", gap: 14, alignContent: "start", padding: 18 }}>
            <button className="button-primary" type="button" onClick={() => void createChat()}>Новый чат</button>
            <input value={chatQuery} onChange={(event) => { setChatQuery(event.target.value); void loadChats(event.target.value); }} placeholder="Поиск по чатам" style={{ width: "100%", minHeight: 42, borderRadius: 12, padding: "0 12px", border: "1px solid var(--border)", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)" }} />
            {filteredChats.map((chat) => (
              <div key={chat.id} className="card" style={{ padding: 14, background: chat.id === chatId ? "rgba(30,111,217,0.16)" : "rgba(255,255,255,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <button type="button" onClick={() => void openChat(chat.id)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}>
                    <div style={{ fontWeight: 700 }}>{chat.isPinned ? "Закреплено · " : ""}{chat.title}</div>
                    <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>{new Date(chat.updatedAt).toLocaleString("ru-RU")}</div>
                  </button>
                  <details>
                    <summary className="button-ghost" style={{ listStyle: "none", minHeight: 36, padding: "0 12px" }}>⋯</summary>
                    <div className="card" style={{ position: "absolute", marginTop: 8, right: 0, width: 200, display: "grid", gap: 8, zIndex: 10 }}>
                      <button className="button-secondary" type="button" onClick={() => { const title = prompt("Новое имя чата", chat.title); if (title) void patchChat(chat.id, { title }); }}>Переименовать</button>
                      <button className="button-secondary" type="button" onClick={() => void patchChat(chat.id, { isPinned: !chat.isPinned })}>{chat.isPinned ? "Открепить" : "Закрепить"}</button>
                      <button className="button-ghost" type="button" onClick={() => void deleteChat(chat.id)}>Удалить</button>
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </aside>

          <div style={{ display: "grid", gap: 16 }}>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(220px, 0.8fr) auto auto", gap: 10, alignItems: "center" }}>
                <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} style={{ width: "100%", minHeight: 44, borderRadius: 14, padding: "0 12px", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                  <option value="">Без проекта</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
                </select>
                <select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} style={{ width: "100%", minHeight: 44, borderRadius: 14, padding: "0 12px", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                  {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                </select>
                <label className="button-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={useProjectContext} onChange={(event) => setUseProjectContext(event.target.checked)} />
                  Контекст проекта
                </label>
                <label className="button-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={useWebSearch} onChange={(event) => setUseWebSearch(event.target.checked)} />
                  Поиск по интернету
                </label>
              </div>
              {selectedFiles.length ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  {selectedFiles.map((fileId) => {
                    const file = files.find((entry) => entry.id === fileId);
                    return file ? <span key={file.id} className="badge">{file.originalName}</span> : null;
                  })}
                </div>
              ) : null}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: splitCanvas ? "minmax(0, 1.2fr) minmax(320px, 0.8fr)" : "minmax(0, 1fr)", gap: 18 }}>
              <section className="card" style={{ display: "grid", gridTemplateRows: "1fr auto", minHeight: 760, padding: 18 }}>
                <div style={{ display: "grid", gap: 14, alignContent: "start", paddingBottom: 24, overflow: "auto" }}>
                  {messages.length === 0 ? <div className="muted">Выбери чат или начни новый диалог.</div> : null}
                  {messages.map((message, index) => (
                    <article key={`${message.role}-${index}`} style={{ justifySelf: message.role === "user" ? "end" : "start", maxWidth: "92%", padding: "18px 20px", borderRadius: 22, background: message.role === "user" ? "linear-gradient(135deg, rgba(30,111,217,0.92), rgba(0,200,232,0.7))" : "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: message.role === "user" ? "0 18px 40px rgba(30,111,217,0.18)" : "none" }}>
                      <div dangerouslySetInnerHTML={{ __html: renderMessageHtml(message.content) }} />
                      {message.attachments?.length ? <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>Файлы: {message.attachments.map((attachment) => attachment.originalName).join(", ")}</div> : null}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                        <button className="button-secondary" type="button" onClick={() => void navigator.clipboard.writeText(message.content)}>Скопировать</button>
                        {message.role === "user" ? <button className="button-secondary" type="button" onClick={() => setInput(message.content)}>Изменить и отправить</button> : null}
                        {message.role === "assistant" ? <button className="button-secondary" type="button" onClick={() => void createCanvasFromMessage(message.content)}>Открыть в редакторе</button> : null}
                        {message.role === "assistant" ? <button className="button-secondary" type="button" onClick={() => void createDocumentFromMessage(message.content)}>Создать документ</button> : null}
                        {message.role === "assistant" && index >= 1 ? <button className="button-secondary" type="button" onClick={(event) => void onSubmit(event as unknown as FormEvent<HTMLFormElement>, messages[index - 1]?.content || "")}>Повторить ответ</button> : null}
                      </div>
                    </article>
                  ))}
                </div>

                <form onSubmit={(event) => void onSubmit(event)} style={{ display: "grid", gap: 12, background: "rgba(9,13,19,0.9)", borderRadius: 20, padding: 14, border: "1px solid var(--border)" }} onDrop={onDrop} onDragOver={(event) => event.preventDefault()}>
                  <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={4} placeholder="Напиши сообщение или перетащи файлы сюда..." style={{ width: "100%", resize: "vertical", borderRadius: 18, padding: 16, background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <label className="button-secondary" style={{ cursor: "pointer" }}>
                      Загрузить файлы
                      <input hidden multiple type="file" onChange={(event) => { if (event.target.files?.length) void uploadComposerFiles(event.target.files); }} />
                    </label>
                    <span className="muted">Поддерживаются тексты, изображения, документы и медиафайлы.</span>
                  </div>
                  {error ? <div style={{ color: "var(--error)" }}>{error}</div> : null}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
                    <button className="button-primary" type="submit" disabled={loading || !activeModel}>{loading ? "Думаем..." : "Отправить"}</button>
                  </div>
                </form>
              </section>

              {splitCanvas ? (
                <aside className="card" style={{ display: "grid", gap: 14, alignContent: "start", padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <div>
                      <div className="badge">Редактор рядом</div>
                      <div style={{ fontWeight: 700, marginTop: 10 }}>{splitCanvas.title}</div>
                    </div>
                    <div className="muted">{presentCanvasStatus(canvasStatus)}</div>
                  </div>
                  <textarea
                    value={splitCanvas.currentContent}
                    onChange={(event) => setSplitCanvas((current) => current ? { ...current, currentContent: event.target.value } : current)}
                    rows={18}
                    style={{ width: "100%", borderRadius: 14, padding: 14, background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  />
                  <textarea
                    value={canvasSelection}
                    onChange={(event) => setCanvasSelection(event.target.value)}
                    rows={4}
                    placeholder="Фрагмент для правки"
                    style={{ width: "100%", borderRadius: 14, padding: 14, background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(["improve", "shorten", "translate", "explain", "refactor"] as const).map((rewriteAction) => (
                      <button key={rewriteAction} className="button-secondary" type="button" onClick={() => void patchSplitCanvas({ mode: "rewrite", selection: canvasSelection || undefined, action: rewriteAction })}>
                        {rewriteActionLabel(rewriteAction)}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <select value={rollbackVersion} onChange={(event) => setRollbackVersion(event.target.value)} style={{ minHeight: 42, borderRadius: 12, padding: "0 12px", border: "1px solid var(--border)", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)" }}>
                      <option value="">Выбери версию</option>
                      {(splitCanvas.versions || []).map((version) => <option key={version.version} value={String(version.version)}>Версия {version.version}</option>)}
                    </select>
                    <button className="button-secondary" type="button" disabled={!rollbackVersion} onClick={() => void patchSplitCanvas({ mode: "rollback", version: Number(rollbackVersion) })}>Откатить</button>
                    <a className="button-secondary" href={`/canvas/${splitCanvas.id}`}>Открыть полностью</a>
                  </div>
                  <div className="card" style={{ padding: 14 }}>
                    <div style={{ fontWeight: 700, marginBottom: 10 }}>История обработки</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {toolEvents.map((event) => (
                        <div key={event.id} className="card" style={{ padding: 12 }}>
                          <div style={{ fontWeight: 700 }}>{presentToolName(event.toolName)}</div>
                          <div className="muted" style={{ marginTop: 4 }}>{presentToolStatus(event.status)}</div>
                        </div>
                      ))}
                      {toolEvents.length === 0 ? <div className="muted">Когда появятся дополнительные шаги обработки, они отобразятся здесь.</div> : null}
                    </div>
                  </div>
                </aside>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
