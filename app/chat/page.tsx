"use client";

import { FormEvent, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppIcon } from "@/components/app/icon";
import { ModelPicker } from "@/components/app/model-picker";
import { FormattedMessage } from "@/components/app/formatted-message";
import { buildUiModels, type UiModel } from "@/lib/model-ui";

type ChatSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type UserFile = {
  id: string;
  originalName: string;
};

type Project = {
  id: string;
  title: string;
};

function ChatComposer({
  input,
  loading,
  selectedModel,
  selectedModelName,
  tokenBalance,
  useWebSearch,
  onToggleWebSearch,
  onInputChange,
  onSubmit,
  textareaRef,
  placeholder
}: {
  input: string;
  loading: boolean;
  selectedModel: string;
  selectedModelName: string;
  tokenBalance: number | null;
  useWebSearch: boolean;
  onToggleWebSearch: () => void;
  onInputChange: (value: string, element: HTMLTextAreaElement) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  placeholder: string;
}) {
  return (
    <form onSubmit={onSubmit} className="composer-shell">
      <div className="composer-modes">
        <button type="button" className={`mode-pill ${useWebSearch ? "active" : ""}`} onClick={onToggleWebSearch}>
          🔍 {useWebSearch ? "Поиск вкл" : "Веб-поиск"}
        </button>
        <a href="/tools/image" className="mode-pill">🖼 Изображения</a>
        <a href="/tools/video" className="mode-pill">🎬 Видео</a>
        <a href="/files" className="mode-pill">📄 Файлы</a>
      </div>

      <div className="composer-input-row">
        <textarea
          ref={textareaRef}
          className="composer-textarea"
          value={input}
          rows={1}
          onChange={(e) => onInputChange(e.target.value, e.target)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={placeholder}
        />
        <button className="composer-send-btn" type="submit" disabled={loading || !selectedModel} title="Отправить (Enter)">
          ↑
        </button>
      </div>

      <div className="composer-footer">
        <div className="composer-meta">
          <span style={{ color: "var(--text-soft)", fontSize: 14 }}>{selectedModelName || "Выберите модель"}</span>
          {tokenBalance !== null && (
            <span style={{ color: "var(--brand-cyan)", fontSize: 13, fontFamily: "monospace" }}>
              {tokenBalance.toLocaleString("ru-RU")} ток.
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Shift+Enter — новая строка</span>
      </div>
    </form>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function familyFromSearchParam(value: string | null, models: UiModel[]) {
  if (!value) return null;
  const match = models.find((model) => model.family === value);
  return match?.id || null;
}

export default function ChatPage() {
  const searchParams = useSearchParams();
  const [models, setModels] = useState<UiModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [files, setFiles] = useState<UserFile[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [useProjectContext, setUseProjectContext] = useState(true);
  const [bootstrappedChats, setBootstrappedChats] = useState(false);
  const [bootstrappedContext, setBootstrappedContext] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void loadModels();
    void loadBalance();
  }, []);

  useEffect(() => {
    if (models.length === 0) return;

    if (searchParams.get("new") === "1") {
      startNewChat();
      return;
    }

    const byFamily = familyFromSearchParam(searchParams.get("family"), models);
    if (byFamily) {
      setSelectedModel(byFamily);
      return;
    }

    if (!selectedModel && models[0]?.id) {
      setSelectedModel(models[0].id);
    }
  }, [models, searchParams, selectedModel]);

  useEffect(() => {
    if (!historyOpen || bootstrappedChats) return;
    setBootstrappedChats(true);
    void loadChats();
  }, [bootstrappedChats, historyOpen]);

  useEffect(() => {
    if (!settingsOpen || bootstrappedContext) return;
    setBootstrappedContext(true);
    void loadContextPanel();
  }, [bootstrappedContext, settingsOpen]);

  // Автопрокрутка к последнему сообщению
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function loadModels() {
    setModelsLoading(true);
    try {
      const response = await fetch("/api/models");
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.message || "Не удалось загрузить модели");
        return;
      }
      const nextModels = buildUiModels(payload.data || []).filter((model) => model.supportsChat !== false);
      setModels(nextModels);
      const preferred =
        nextModels.find((model) => model.family === "chatgpt") ||
        nextModels.find((model) => model.family === "gemini") ||
        nextModels.find((model) => model.family === "claude") ||
        nextModels[0];
      if (preferred?.id) setSelectedModel(preferred.id);
    } finally {
      setModelsLoading(false);
    }
  }

  async function loadBalance() {
    try {
      const response = await fetch("/api/auth/me");
      const payload = await response.json();
      const user = payload.data?.user || payload.user;
      if (response.ok && user?.tokenBalance != null) {
        setTokenBalance(user.tokenBalance);
      }
    } catch {}
  }

  async function loadChats() {
    const response = await fetch("/api/chats?pageSize=24");
    const payload = await response.json();
    if (response.ok) setChats(payload.data?.chats || []);
  }

  async function openChat(nextChatId: string) {
    setLoadingMessages(true);
    setError("");
    const response = await fetch(`/api/chats/${nextChatId}/messages`);
    const payload = await response.json();
    setLoadingMessages(false);

    if (!response.ok) {
      setError("Не удалось открыть диалог");
      return;
    }

    setChatId(nextChatId);
    setMessages(
      (payload.messages || []).map((message: { role: ChatMessage["role"]; content: string }) => ({
        role: message.role,
        content: message.content
      }))
    );
    setHistoryOpen(false);
    setModelPickerOpen(false);
    setOverflowOpen(false);
  }

  async function loadContextPanel() {
    const [projectsResponse, filesResponse] = await Promise.all([fetch("/api/projects"), fetch("/api/files")]);
    const [projectsPayload, filesPayload] = await Promise.all([projectsResponse.json(), filesResponse.json()]);
    if (projectsResponse.ok) setProjects(projectsPayload.data?.projects || []);
    if (filesResponse.ok) setFiles(filesPayload.data?.files || []);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || !selectedModel || loading) return;

    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    const nextMessages: ChatMessage[] = [...messages, userMessage];

    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);
    setError("");
    setModelPickerOpen(false);
    setOverflowOpen(false);

    // Сбросить высоту textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: chatId || undefined,
          projectId: selectedProjectId || undefined,
          model: selectedModel,
          attachmentIds: selectedFiles,
          tools: { webSearch: useWebSearch, projectContext: useProjectContext },
          messages: nextMessages
        })
      });

      if (!response.ok) {
        let errMsg = "Ошибка отправки";
        try {
          const payload = await response.json();
          errMsg = payload.message || payload.error || errMsg;
        } catch {}
        setError(errMsg);
        setMessages(nextMessages);
        setLoading(false);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      let currentEvent = "";
      let newChatId = chatId;

      const processBlock = (block: string) => {
        const lines = block.split("\n");
        for (const line of lines) {
          if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            const raw = line.slice(5).trim();
            if (!raw || raw === "[DONE]") continue;
            try {
              const parsed = JSON.parse(raw) as Record<string, unknown>;
              if (currentEvent === "delta" || typeof parsed.content === "string") {
                const piece = typeof parsed.content === "string" ? parsed.content : "";
                if (piece) {
                  fullContent += piece;
                  setMessages([...nextMessages, { role: "assistant", content: fullContent }]);
                }
              }
              if (currentEvent === "error") {
                const errMsg = typeof parsed.message === "string"
                  ? parsed.message
                  : "Произошла ошибка. Попробуйте ещё раз.";
                setError(errMsg);
                setMessages(nextMessages);
                return;
              }
              if (currentEvent === "done" || currentEvent === "meta") {
                if (parsed.chatId) newChatId = parsed.chatId as string;
                if (typeof parsed.tokenBalance === "number") {
                  setTokenBalance(parsed.tokenBalance);
                  window.dispatchEvent(new Event("elbrusway:balance-changed"));
                }
              }
            } catch (parseError) {
              console.warn("[chat-page] SSE parse error:", raw, parseError);
            }
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          processBlock(block);
        }
      }

      // Process remaining buffer
      if (buffer.trim()) processBlock(buffer);

      setChatId(newChatId);
      await loadChats();
    } catch (err) {
      setError((err as Error).message || "Ошибка соединения");
      setMessages(nextMessages);
    } finally {
      setLoading(false);
    }
  }

  function startNewChat() {
    setChatId(null);
    setMessages([]);
    setInput("");
    setError("");
    setOverflowOpen(false);
    setHistoryOpen(false);
    setModelPickerOpen(true);
  }

  const selectedModelMeta = useMemo(
    () => models.find((model) => model.id === selectedModel) || null,
    [models, selectedModel]
  );

  const heroMode = !chatId && messages.length === 0;
  const selectedFilesPreview = files.filter((file) => selectedFiles.includes(file.id)).slice(0, 3);

  return (
    <div className="page-stack chat-page">
      <section className={heroMode ? "chat-stage chat-stage-start" : "chat-stage"}>
        <div className="chat-toolbar">
          <div className="chat-toolbar-primary">
            <button type="button" className="button-secondary compact-button" onClick={() => setHistoryOpen((v) => !v)}>
              <AppIcon name="chat" size={16} />
              История
            </button>
            <button type="button" className="button-secondary compact-button" onClick={() => setSettingsOpen((v) => !v)}>
              <AppIcon name="panel" size={16} />
              Параметры
            </button>
          </div>
          <div className="chat-toolbar-secondary">
            <button type="button" className="button-ghost compact-button" onClick={() => setOverflowOpen((v) => !v)}>
              <AppIcon name="menu" size={16} />
              Ещё
            </button>
          </div>
          {overflowOpen && (
            <div className="overflow-popover">
              <button type="button" className="nav-link" onClick={startNewChat}>
                <span className="nav-link-icon"><AppIcon name="plus" size={16} /></span>
                <span>Начать заново</span>
              </button>
              <button type="button" className="nav-link" onClick={() => setModelPickerOpen((v) => !v)}>
                <span className="nav-link-icon"><AppIcon name="spark" size={16} /></span>
                <span>Выбрать модель</span>
              </button>
              <a href="/canvas" className="nav-link" title="Open full canvas">
                <span className="nav-link-icon"><AppIcon name="edit" size={16} /></span>
                <span>Canvas</span>
              </a>
            </div>
          )}
        </div>

        {heroMode ? (
          <div className="chat-start-shell">
            <div className="chat-start-copy">
              <div className="eyebrow">Чат</div>
              <h1 className="chat-hero-title">Начните с одного сообщения.</h1>
              <p className="surface-copy">
                Модель выбирается отдельно и понятно. Проект, файлы и поиск подключаются только когда действительно нужны.
              </p>
            </div>

            <div className="chat-start-card surface">
              <div className="chat-start-topline">
                <div className="selected-model-pill">
                  <span className="selected-model-label">Модель</span>
                  <strong>{selectedModelMeta?.name || "Выберите модель"}</strong>
                </div>
                <button type="button" className="button-secondary compact-button" onClick={() => setModelPickerOpen(true)}>
                  Выбрать модель
                </button>
              </div>

              {(heroMode || modelPickerOpen) && (
                <ModelPicker
                  models={models}
                  value={selectedModel}
                  onChange={(modelId) => {
                    setSelectedModel(modelId);
                    setModelPickerOpen(false);
                  }}
                  title="Выберите модель для диалога"
                  description="Выбор разбит по знакомым названиям и сценариям."
                  mode="chat"
                />
              )}

              {modelsLoading && <div className="muted-text">Загружаем модели...</div>}

              <ChatComposer
                input={input}
                loading={loading}
                selectedModel={selectedModel}
                selectedModelName={selectedModelMeta?.name || ""}
                tokenBalance={tokenBalance}
                useWebSearch={useWebSearch}
                onToggleWebSearch={() => setUseWebSearch((v) => !v)}
                onInputChange={(value, element) => {
                  setInput(value);
                  element.style.height = "auto";
                  element.style.height = `${Math.min(element.scrollHeight, 180)}px`;
                }}
                onSubmit={sendMessage}
                textareaRef={textareaRef}
                placeholder="Напишите задачу обычным языком: объяснить, придумать, сравнить, составить текст."
              />
            </div>
          </div>
        ) : (
          <section className="surface thread-card thread-shell">
            <div className="thread-head">
              <div>
                <div className="selected-model-label">Текущая модель</div>
                <strong>{selectedModelMeta?.name || "Чат"}</strong>
              </div>
              <div className="thread-head-actions">
                <button type="button" className="button-secondary compact-button" onClick={() => setModelPickerOpen((v) => !v)}>
                  Сменить модель
                </button>
                <button type="button" className="button-ghost compact-button" onClick={startNewChat}>
                  Новый чат
                </button>
              </div>
            </div>

            {modelPickerOpen && (
              <ModelPicker
                models={models}
                value={selectedModel}
                onChange={(modelId) => {
                  setSelectedModel(modelId);
                  setModelPickerOpen(false);
                }}
                title="Сменить модель"
                description="Переключение доступно в любой момент."
                mode="chat"
              />
            )}

            {modelsLoading && <div className="muted-text">Загружаем модели...</div>}

            <div className="thread-content" ref={threadRef} style={{ maxHeight: "60vh", overflowY: "auto" }}>
              {loadingMessages && <div className="muted-text">Открываем диалог...</div>}

              {messages.map((msg, idx) => {
                const isUser = msg.role === "user";
                const isEmptyAssistant = msg.role === "assistant" && !msg.content && loading && idx === messages.length - 1;

                if (isEmptyAssistant) {
                  return (
                    <div key={`typing-${idx}`} className="message-card assistant">
                      <div className="message-avatar ai-av">AI</div>
                      <div className="typing-dots">
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={`${msg.role}-${idx}`} className={`message-card ${msg.role}`}>
                    <div className={`message-avatar ${isUser ? "user-av" : "ai-av"}`}>
                      {isUser ? "Я" : "AI"}
                    </div>
                    <div>
                      <div className="message-bubble">
                        <FormattedMessage content={msg.content} />
                      </div>
                      {msg.role === "assistant" && msg.content && (
                        <div className="message-meta">
                          <button
                            type="button"
                            className="button-ghost compact-button"
                            style={{ fontSize: 11, minHeight: 24, padding: "0 8px" }}
                            onClick={() => navigator.clipboard.writeText(msg.content)}
                          >
                            Копировать
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <ChatComposer
              input={input}
              loading={loading}
              selectedModel={selectedModel}
              selectedModelName={selectedModelMeta?.name || ""}
              tokenBalance={tokenBalance}
              useWebSearch={useWebSearch}
              onToggleWebSearch={() => setUseWebSearch((v) => !v)}
              onInputChange={(value, element) => {
                setInput(value);
                element.style.height = "auto";
                element.style.height = `${Math.min(element.scrollHeight, 180)}px`;
              }}
              onSubmit={sendMessage}
              textareaRef={textareaRef}
              placeholder="Продолжите диалог или задайте новую задачу."
            />
          </section>
        )}

        {error && (
          <div className="error-banner" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span>⚠️</span>
            <span>{error}</span>
            {(error.includes("Тарифы") || error.includes("баланс")) && (
              <a href="/rates" className="button-primary compact-button" style={{ marginLeft: "auto", fontSize: 12 }}>
                Пополнить →
              </a>
            )}
          </div>
        )}
      </section>

      {/* История чатов */}
      <div className={historyOpen ? "drawer-backdrop visible" : "drawer-backdrop"} onClick={() => setHistoryOpen(false)} />
      <aside className={historyOpen ? "chat-drawer open" : "chat-drawer"}>
        <div className="drawer-head">
          <div>
            <div className="eyebrow">История</div>
            <h2 className="surface-title" style={{ fontSize: 18 }}>Ваши диалоги</h2>
          </div>
          <button type="button" className="icon-button" onClick={() => setHistoryOpen(false)}>
            <AppIcon name="close" size={18} />
          </button>
        </div>
        <div className="chat-list">
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              className={chat.id === chatId ? "chat-list-card active" : "chat-list-card"}
              onClick={() => void openChat(chat.id)}
            >
              <div className="chat-item-title">{chat.title}</div>
              <div className="chat-item-copy">{formatDate(chat.updatedAt)}</div>
            </button>
          ))}
          {chats.length === 0 && (
            <div className="muted-text">История появится здесь после первого диалога.</div>
          )}
        </div>
        <div>
          <button type="button" className="button-primary" style={{ width: "100%" }} onClick={startNewChat}>
            + Новый чат
          </button>
        </div>
      </aside>

      {/* Параметры */}
      <div className={settingsOpen ? "drawer-backdrop visible" : "drawer-backdrop"} onClick={() => setSettingsOpen(false)} />
      <aside className={settingsOpen ? "context-drawer open" : "context-drawer"}>
        <div className="drawer-head">
          <div>
            <div className="eyebrow">Параметры</div>
            <h2 className="surface-title" style={{ fontSize: 18 }}>Текущий чат</h2>
          </div>
          <button type="button" className="icon-button" onClick={() => setSettingsOpen(false)}>
            <AppIcon name="close" size={18} />
          </button>
        </div>

        <div className="section-stack">
          <label className="field">
            <span>Проект</span>
            <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
              <option value="">Без проекта</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Файлы</span>
            <select
              multiple
              value={selectedFiles}
              onChange={(e) => setSelectedFiles(Array.from(e.target.selectedOptions).map((o) => o.value))}
              style={{ minHeight: 160 }}
            >
              {files.map((file) => (
                <option key={file.id} value={file.id}>{file.originalName}</option>
              ))}
            </select>
          </label>

          <div className="toggle-row">
            <button type="button" className={useWebSearch ? "toggle-pill active" : "toggle-pill"} onClick={() => setUseWebSearch((v) => !v)}>
              🔍 Веб-поиск
            </button>
            <button type="button" className={useProjectContext ? "toggle-pill active" : "toggle-pill"} onClick={() => setUseProjectContext((v) => !v)}>
              📁 Контекст проекта
            </button>
          </div>

          {selectedFilesPreview.length > 0 ? (
            <div className="status-list">
              {selectedFilesPreview.map((file) => (
                <div key={file.id} className="status-card">
                  <strong>{file.originalName}</strong>
                  <span className="muted-text">Будет добавлен как контекст</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted-text">Выберите проект или файлы только если они нужны запросу.</div>
          )}
        </div>
      </aside>
    </div>
  );
}
