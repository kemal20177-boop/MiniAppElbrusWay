"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppIcon } from "@/components/app/icon";
import { ModelPicker } from "@/components/app/model-picker";
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

function presentRole(role: ChatMessage["role"]) {
  if (role === "user") return "Вы";
  if (role === "assistant") return "ElbrusWay AI";
  return "Система";
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
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(true);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [files, setFiles] = useState<UserFile[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [useProjectContext, setUseProjectContext] = useState(true);
  const [bootstrappedChats, setBootstrappedChats] = useState(false);
  const [bootstrappedContext, setBootstrappedContext] = useState(false);

  useEffect(() => {
    void loadModels();
  }, []);

  useEffect(() => {
    if (models.length === 0) {
      return;
    }

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
    if (!historyOpen || bootstrappedChats) {
      return;
    }
    setBootstrappedChats(true);
    void loadChats();
  }, [bootstrappedChats, historyOpen]);

  useEffect(() => {
    if (!settingsOpen || bootstrappedContext) {
      return;
    }
    setBootstrappedContext(true);
    void loadContextPanel();
  }, [bootstrappedContext, settingsOpen]);

  async function loadModels() {
    const response = await fetch("/api/models");
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.message || "Не удалось загрузить модели");
      return;
    }

    const nextModels = buildUiModels(payload.data || []);
    setModels(nextModels);
    if (nextModels[0]?.id) {
      setSelectedModel(nextModels[0].id);
    }
  }

  async function loadChats() {
    const response = await fetch("/api/chats?pageSize=24");
    const payload = await response.json();
    if (response.ok) {
      setChats(payload.data?.chats || []);
    }
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
    if (projectsResponse.ok) {
      setProjects(projectsPayload.data?.projects || []);
    }
    if (filesResponse.ok) {
      setFiles(filesPayload.data?.files || []);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || !selectedModel || loading) {
      return;
    }

    const currentInput = input.trim();
    const previousMessages = messages;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: currentInput }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");
    setModelPickerOpen(false);
    setOverflowOpen(false);

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: chatId || undefined,
        projectId: selectedProjectId || undefined,
        model: selectedModel,
        attachmentIds: selectedFiles,
        tools: {
          webSearch: useWebSearch,
          projectContext: useProjectContext
        },
        messages: nextMessages
      })
    });

    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.message || "Не удалось получить ответ");
      setMessages(previousMessages);
      return;
    }

    setChatId(payload.chatId);
    setMessages([...nextMessages, { role: "assistant", content: payload.content || "" }]);
    if (typeof payload.tokenBalance === "number") {
      setTokenBalance(payload.tokenBalance);
    }
    setHistoryOpen(false);
    if (bootstrappedChats) {
      await loadChats();
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
            <button type="button" className="button-secondary compact-button" onClick={() => setHistoryOpen((current) => !current)}>
              <AppIcon name="chat" size={16} />
              История
            </button>
            <button type="button" className="button-secondary compact-button" onClick={() => setSettingsOpen((current) => !current)}>
              <AppIcon name="panel" size={16} />
              Параметры
            </button>
          </div>
          <div className="chat-toolbar-secondary">
            <button type="button" className="button-ghost compact-button" onClick={() => setOverflowOpen((current) => !current)}>
              <AppIcon name="menu" size={16} />
              Ещё
            </button>
          </div>
          {overflowOpen ? (
            <div className="overflow-popover">
              <button type="button" className="nav-link" onClick={startNewChat}>
                <span className="nav-link-icon">
                  <AppIcon name="plus" size={16} />
                </span>
                <span>Начать заново</span>
              </button>
              <button type="button" className="nav-link" onClick={() => setModelPickerOpen((current) => !current)}>
                <span className="nav-link-icon">
                  <AppIcon name="spark" size={16} />
                </span>
                <span>Выбрать модель</span>
              </button>
            </div>
          ) : null}
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
                <button type="button" className="button-secondary compact-button" onClick={() => setModelPickerOpen((current) => !current)}>
                  {modelPickerOpen ? "Скрыть подборку" : "Выбрать модель"}
                </button>
              </div>

              {modelPickerOpen ? (
                <ModelPicker
                  models={models}
                  value={selectedModel}
                  onChange={(modelId) => {
                    setSelectedModel(modelId);
                    setModelPickerOpen(false);
                  }}
                  title="Выберите модель для диалога"
                  description="Выбор разбит по знакомым названиям и сценариям, чтобы не листать весь каталог."
                  mode="chat"
                />
              ) : null}

              <form onSubmit={sendMessage} className="composer-shell chat-composer">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Напишите задачу обычным языком: объяснить, придумать, сравнить, проверить, составить текст."
                />
                <div className="toggle-row">
                  <button type="button" className={useWebSearch ? "toggle-pill active" : "toggle-pill"} onClick={() => setUseWebSearch((current) => !current)}>
                    Web search
                  </button>
                  <button
                    type="button"
                    className={useProjectContext ? "toggle-pill active" : "toggle-pill"}
                    onClick={() => setUseProjectContext((current) => !current)}
                  >
                    Контекст проекта
                  </button>
                </div>
                <div className="composer-footer">
                  <div className="composer-meta">
                    <span>{selectedModelMeta?.summary || "Сначала выберите модель"}</span>
                    {tokenBalance !== null ? <span>Баланс: {tokenBalance.toLocaleString("ru-RU")}</span> : null}
                  </div>
                  <button className="button-primary" type="submit" disabled={loading || !selectedModel}>
                    {loading ? "Отвечаем..." : "Отправить"}
                  </button>
                </div>
              </form>
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
                <button type="button" className="button-secondary compact-button" onClick={() => setModelPickerOpen((current) => !current)}>
                  Сменить модель
                </button>
                <button type="button" className="button-ghost compact-button" onClick={startNewChat}>
                  Новый чат
                </button>
              </div>
            </div>

            {modelPickerOpen ? (
              <ModelPicker
                models={models}
                value={selectedModel}
                onChange={(modelId) => {
                  setSelectedModel(modelId);
                  setModelPickerOpen(false);
                }}
                title="Сменить модель"
                description="Переключение доступно в любой момент, без ухода со страницы."
                mode="chat"
              />
            ) : null}

            <div className="thread-content">
              {loadingMessages ? <div className="muted-text">Открываем диалог...</div> : null}
              {messages.map((message, index) => (
                <article key={`${message.role}-${index}`} className={message.role === "user" ? "message-card user" : "message-card assistant"}>
                  <div className="message-meta">
                    <strong>{presentRole(message.role)}</strong>
                  </div>
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{message.content}</div>
                </article>
              ))}
            </div>

            <form onSubmit={sendMessage} className="composer-shell thread-composer">
              <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Продолжите диалог или задайте новую задачу." />
              <div className="composer-footer">
                <div className="composer-meta">
                  <span>{selectedModelMeta?.name || "Модель"}</span>
                  {tokenBalance !== null ? <span>Баланс: {tokenBalance.toLocaleString("ru-RU")}</span> : null}
                </div>
                <button className="button-primary" type="submit" disabled={loading}>
                  {loading ? "Отвечаем..." : "Отправить"}
                </button>
              </div>
            </form>
          </section>
        )}

        {error ? <div className="error-banner">{error}</div> : null}
      </section>

      <div className={historyOpen ? "drawer-backdrop visible" : "drawer-backdrop"} onClick={() => setHistoryOpen(false)} />
      <aside className={historyOpen ? "chat-drawer open" : "chat-drawer"}>
        <div className="drawer-head">
          <div>
            <div className="eyebrow">История</div>
            <h2 className="surface-title">Ваши диалоги</h2>
          </div>
          <button type="button" className="icon-button" onClick={() => setHistoryOpen(false)}>
            <AppIcon name="close" size={18} />
          </button>
        </div>
        <div className="chat-list">
          {chats.map((chat) => (
            <button key={chat.id} type="button" className={chat.id === chatId ? "chat-list-card active" : "chat-list-card"} onClick={() => void openChat(chat.id)}>
              <div className="chat-item-title">{chat.title}</div>
              <div className="chat-item-copy">{formatDate(chat.updatedAt)}</div>
            </button>
          ))}
          {chats.length === 0 ? <div className="muted-text">История появится здесь после первого диалога.</div> : null}
        </div>
      </aside>

      <div className={settingsOpen ? "drawer-backdrop visible" : "drawer-backdrop"} onClick={() => setSettingsOpen(false)} />
      <aside className={settingsOpen ? "context-drawer open" : "context-drawer"}>
        <div className="drawer-head">
          <div>
            <div className="eyebrow">Параметры</div>
            <h2 className="surface-title">Текущий чат</h2>
          </div>
          <button type="button" className="icon-button" onClick={() => setSettingsOpen(false)}>
            <AppIcon name="close" size={18} />
          </button>
        </div>

        <div className="section-stack">
          <label className="field">
            <span>Проект</span>
            <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
              <option value="">Без проекта</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Файлы</span>
            <select
              multiple
              value={selectedFiles}
              onChange={(event) => setSelectedFiles(Array.from(event.target.selectedOptions).map((option) => option.value))}
              style={{ minHeight: 180 }}
            >
              {files.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.originalName}
                </option>
              ))}
            </select>
          </label>

          <div className="toggle-row">
            <button type="button" className={useWebSearch ? "toggle-pill active" : "toggle-pill"} onClick={() => setUseWebSearch((current) => !current)}>
              Web search
            </button>
            <button type="button" className={useProjectContext ? "toggle-pill active" : "toggle-pill"} onClick={() => setUseProjectContext((current) => !current)}>
              Контекст проекта
            </button>
          </div>

          {selectedFilesPreview.length ? (
            <div className="status-list">
              {selectedFilesPreview.map((file) => (
                <div key={file.id} className="status-card">
                  <strong>{file.originalName}</strong>
                  <span className="muted-text">Файл будет использован как дополнительный контекст.</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted-text">Выберите проект или файлы только если они действительно нужны текущему запросу.</div>
          )}
        </div>
      </aside>
    </div>
  );
}
