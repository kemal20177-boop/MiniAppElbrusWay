"use client";

import { FormEvent, useEffect, useState } from "react";
import { defaultModelId } from "@/lib/site";

type ChatSummary = {
  id: string;
  title: string;
  model: string;
  updatedAt: string;
  projectId?: string | null;
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

function formatPricePerMillion(value?: number) {
  if (typeof value !== "number") {
    return "n/a";
  }

  return `${(value * 1_000_000).toFixed(2)} ₽`;
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

  useEffect(() => {
    void Promise.all([loadModels(), loadChats(), loadProjects(), loadFiles(), loadProfile()]);
  }, []);

  async function loadModels() {
    const response = await fetch("/api/models");
    const payload = await response.json();
    if (!response.ok || !Array.isArray(payload.data)) {
      return;
    }

    setModels(payload.data);
    if (!payload.data.some((entry: ModelOption) => entry.id === selectedModel) && payload.data[0]?.id) {
      setSelectedModel(payload.data[0].id);
    }
  }

  async function loadChats() {
    const response = await fetch("/api/chats");
    const payload = await response.json();
    if (!response.ok) {
      setError("Нужна авторизация для работы с чатами");
      return;
    }

    setChats(payload.chats || []);
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

    setChatId(payload.chat.id);
    setMessages([]);
    setToolEvents([]);
    await loadChats();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || loading) {
      return;
    }

    const attachedFiles = files.filter((file) => selectedFiles.includes(file.id));
    const previousMessages = messages;
    const nextMessages = [
      ...messages,
      {
        role: "user" as const,
        content: input,
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
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let boundaryIndex = buffer.indexOf("\n\n");

        while (boundaryIndex !== -1) {
          const block = buffer.slice(0, boundaryIndex);
          buffer = buffer.slice(boundaryIndex + 2);
          boundaryIndex = buffer.indexOf("\n\n");

          const eventType = block.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
          const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
          if (!eventType || !dataLine) {
            continue;
          }

          const payload = JSON.parse(dataLine.slice(5).trim()) as Record<string, unknown>;

          if (eventType === "meta") {
            finalChatId = typeof payload.chatId === "string" ? payload.chatId : finalChatId;
          }

          if (eventType === "tool") {
            setToolEvents((prev) => [...prev, payload as unknown as ToolEvent]);
          }

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

          if (eventType === "error") {
            throw new Error(String(payload.message || "STREAM_FAILED"));
          }
        }
      }

      setChatId(finalChatId);
      setSelectedFiles([]);
      if (typeof finalTokenBalance === "number") {
        setTokenBalance(finalTokenBalance);
      }
      await loadChats();
    } catch (nextError) {
      setMessages(previousMessages);
      setError((nextError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const activeModel = models.find((entry) => entry.id === selectedModel);

  return (
    <main className="workspace-page">
      <section className="panel workspace-panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div>
            <div className="badge">Chat Core 2.0</div>
            <h1 className="section-title" style={{ marginTop: 16 }}>Чат, проекты, файлы и tools</h1>
            <p className="section-copy" style={{ maxWidth: 880 }}>
              SSE-стриминг, project context, chat attachments и web search уже работают как единый сценарий.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span className="badge">Баланс: {tokenBalance ?? "..."}</span>
            <span className="badge">{activeModel?.name || selectedModel}</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0, 1fr) 340px", gap: 20, marginTop: 24 }}>
          <aside className="card" style={{ display: "grid", gap: 12, alignContent: "start" }}>
            <button className="button-primary" type="button" onClick={() => void createChat()}>Новый чат</button>
            <div className="muted" style={{ fontSize: 14 }}>История</div>
            {chats.map((chat) => (
              <button key={chat.id} type="button" className="card" onClick={() => void openChat(chat.id)} style={{ padding: 16, textAlign: "left", background: chat.id === chatId ? "rgba(30,111,217,0.18)" : "rgba(255,255,255,0.03)" }}>
                <div style={{ fontWeight: 700 }}>{chat.title}</div>
                <div className="muted" style={{ marginTop: 6 }}>{new Date(chat.updatedAt).toLocaleString("ru-RU")}</div>
              </button>
            ))}
          </aside>

          <section className="card" style={{ display: "grid", gridTemplateRows: "1fr auto", minHeight: 720 }}>
            <div style={{ display: "grid", gap: 12, alignContent: "start", paddingBottom: 20 }}>
              {messages.length === 0 ? <div className="muted">Выбери чат или отправь первое сообщение.</div> : null}
              {messages.map((message, index) => (
                <article key={`${message.role}-${index}`} style={{ justifySelf: message.role === "user" ? "end" : "start", maxWidth: "86%", padding: "16px 18px", borderRadius: 18, background: message.role === "user" ? "linear-gradient(135deg, rgba(30,111,217,0.9), rgba(0,200,232,0.65))" : "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", whiteSpace: "pre-wrap" }}>
                  <div>{message.content}</div>
                  {message.attachments?.length ? (
                    <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>
                      Вложения: {message.attachments.map((attachment) => attachment.originalName).join(", ")}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
              <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={6} placeholder="Напиши сообщение или задачу..." style={{ width: "100%", resize: "vertical", borderRadius: 18, padding: 16, background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              {error ? <div style={{ color: "var(--error)" }}>{error}</div> : null}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div className="muted">
                  In: {formatPricePerMillion(activeModel?.pricing?.prompt)} · Out: {formatPricePerMillion(activeModel?.pricing?.completion)}
                </div>
                <button className="button-primary" type="submit" disabled={loading || !activeModel}>
                  {loading ? "Генерация..." : "Отправить"}
                </button>
              </div>
            </form>
          </section>

          <aside className="card" style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <h2 style={{ margin: 0 }}>Контекст</h2>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="muted">Проект</span>
              <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} style={{ width: "100%", minHeight: 44, borderRadius: 14, padding: "0 12px", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                <option value="">Без проекта</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.title}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="muted">Модель</span>
              <select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} style={{ width: "100%", minHeight: 44, borderRadius: 14, padding: "0 12px", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>{model.provider} · {model.name}</option>
                ))}
              </select>
            </label>
            <div>
              <div className="muted" style={{ marginBottom: 8 }}>Вложения</div>
              <div style={{ display: "grid", gap: 8, maxHeight: 180, overflow: "auto" }}>
                {files.map((file) => (
                  <label key={file.id} className="card" style={{ padding: 12, display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedFiles.includes(file.id)}
                      onChange={(event) => {
                        setSelectedFiles((prev) =>
                          event.target.checked ? [...prev, file.id] : prev.filter((entry) => entry !== file.id)
                        );
                      }}
                    />
                    <span>{file.originalName}</span>
                  </label>
                ))}
                {files.length === 0 ? <div className="muted">Файлов пока нет. Сначала загрузи их в Files.</div> : null}
              </div>
            </div>
            <label className="card" style={{ padding: 14, display: "flex", gap: 10, alignItems: "center" }}>
              <input type="checkbox" checked={useProjectContext} onChange={(event) => setUseProjectContext(event.target.checked)} />
              <span>Подмешивать контекст проекта</span>
            </label>
            <label className="card" style={{ padding: 14, display: "flex", gap: 10, alignItems: "center" }}>
              <input type="checkbox" checked={useWebSearch} onChange={(event) => setUseWebSearch(event.target.checked)} />
              <span>Использовать web search tool</span>
            </label>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Tool events</div>
              <div style={{ display: "grid", gap: 8 }}>
                {toolEvents.map((event) => (
                  <div key={event.id} className="muted">
                    {event.toolName} · {event.status}
                  </div>
                ))}
                {toolEvents.length === 0 ? <div className="muted">Tool events появятся здесь во время генерации.</div> : null}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
