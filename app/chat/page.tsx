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
  const [panelOpen, setPanelOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [files, setFiles] = useState<UserFile[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [useProjectContext, setUseProjectContext] = useState(true);

  useEffect(() => {
    void loadInitial();
  }, []);

  useEffect(() => {
    if (models.length === 0) {
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

  async function loadInitial() {
    const [modelsResponse, chatsResponse, profileResponse] = await Promise.all([
      fetch("/api/models"),
      fetch("/api/chats"),
      fetch("/api/user/profile")
    ]);

    const modelsPayload = await modelsResponse.json();
    const chatsPayload = await chatsResponse.json();
    const profilePayload = await profileResponse.json();

    if (modelsResponse.ok) {
      const nextModels = buildUiModels(modelsPayload.data || []);
      setModels(nextModels);
      if (nextModels[0]?.id) {
        setSelectedModel(nextModels[0].id);
      }
    }

    if (chatsResponse.ok) {
      setChats(chatsPayload.data?.chats || []);
    }

    if (profileResponse.ok) {
      setTokenBalance(profilePayload.user?.tokenBalance ?? null);
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
    setMessages((payload.messages || []).map((message: { role: ChatMessage["role"]; content: string }) => ({
      role: message.role,
      content: message.content
    })));
  }

  async function loadContextPanel() {
    if (projects.length && files.length) {
      return;
    }
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

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: input.trim() }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

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
      setMessages(messages);
      return;
    }

    setChatId(payload.chatId);
    setMessages([...nextMessages, { role: "assistant", content: payload.content || "" }]);
    if (typeof payload.tokenBalance === "number") {
      setTokenBalance(payload.tokenBalance);
    }
    await loadChats();
  }

  async function loadChats() {
    const response = await fetch("/api/chats");
    const payload = await response.json();
    if (response.ok) {
      setChats(payload.data?.chats || []);
    }
  }

  function startNewChat() {
    setChatId(null);
    setMessages([]);
    setInput("");
    setError("");
  }

  const selectedModelMeta = useMemo(
    () => models.find((model) => model.id === selectedModel) || null,
    [models, selectedModel]
  );

  const heroMode = !chatId && messages.length === 0;

  return (
    <div className="page-stack">
      <div className="chat-layout">
        <aside className="chat-sidebar-column">
          <section className="surface">
            <div className="toolbar-row">
              <button type="button" className="button-primary" onClick={startNewChat}>
                <AppIcon name="plus" size={16} />
                Новый чат
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setPanelOpen((current) => !current);
                  void loadContextPanel();
                }}
              >
                <AppIcon name="panel" size={16} />
                Панель
              </button>
            </div>
            <div className="chat-list" style={{ marginTop: 16 }}>
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
              {chats.length === 0 ? <div className="muted-text">История чатов появится здесь.</div> : null}
            </div>
          </section>
        </aside>

        <section className="chat-main-column">
          {heroMode ? (
            <div className="surface chat-hero">
              <div className="chat-hero-inner">
                <div className="eyebrow">Чат</div>
                <h1 className="chat-hero-title">С чего начать?</h1>
                <p className="surface-copy">
                  Выберите модель, напишите запрос обычным языком и при необходимости подключите поиск, проект или файлы.
                </p>
                <ModelPicker
                  models={models.filter((model) => model.supportsChat)}
                  value={selectedModel}
                  onChange={setSelectedModel}
                  title="Быстрый выбор модели для чата"
                  description="Здесь собраны популярные модели для общения, идей, анализа и повседневных задач."
                />
                <form onSubmit={sendMessage} className="composer-shell">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Напишите, что хотите сделать: спросить, сравнить, придумать, объяснить или подготовить текст."
                  />
                  <div className="toggle-row">
                    <button type="button" className="toggle-pill" onClick={() => setUseWebSearch((current) => !current)}>
                      {useWebSearch ? "Поиск включён" : "Добавить поиск"}
                    </button>
                    <button type="button" className="toggle-pill" onClick={() => setUseProjectContext((current) => !current)}>
                      {useProjectContext ? "Контекст проекта включён" : "Контекст проекта выключен"}
                    </button>
                  </div>
                  <div className="composer-footer">
                    <div className="composer-meta">
                      <span>{selectedModelMeta?.name || "Выберите модель"}</span>
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
            <section className="surface thread-card">
              <div className="composer-meta">
                <strong>{selectedModelMeta?.name || "Чат"}</strong>
                <div className="message-actions">
                  <button
                    type="button"
                    className="button-ghost compact-button"
                    onClick={() => {
                      setPanelOpen((current) => !current);
                      void loadContextPanel();
                    }}
                  >
                    Параметры
                  </button>
                  <button type="button" className="overflow-menu">
                    <AppIcon name="menu" size={16} />
                  </button>
                </div>
              </div>

              <div className="thread-content">
                {loadingMessages ? <div className="muted-text">Открываем диалог...</div> : null}
                {messages.map((message, index) => (
                  <article key={`${message.role}-${index}`} className={message.role === "user" ? "message-card user" : "message-card assistant"}>
                    <div className="message-meta">
                      <strong>{presentRole(message.role)}</strong>
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{message.content}</div>
                  </article>
                ))}
              </div>

              <form onSubmit={sendMessage} className="composer-shell">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Продолжите диалог или задайте новый вопрос."
                />
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
      </div>

      <aside className={panelOpen ? "surface right-panel open" : "surface right-panel"}>
        <div className="section-stack">
          <div>
            <div className="eyebrow">Параметры</div>
            <h2 className="surface-title">Настройте текущий чат</h2>
            <p className="surface-copy">Выберите проект, прикрепите файлы и при желании смените модель.</p>
          </div>

          <ModelPicker
            models={models.filter((model) => model.supportsChat)}
            value={selectedModel}
            onChange={setSelectedModel}
            title="Модель для диалога"
            description="Переключение доступно в любой момент."
          />

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
              style={{ minHeight: 160 }}
            >
              {files.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.originalName}
                </option>
              ))}
            </select>
          </label>

          <div className="toggle-row">
            <button type="button" className="toggle-pill" onClick={() => setUseWebSearch((current) => !current)}>
              {useWebSearch ? "Поиск включён" : "Добавить поиск"}
            </button>
            <button type="button" className="toggle-pill" onClick={() => setUseProjectContext((current) => !current)}>
              {useProjectContext ? "Контекст проекта включён" : "Контекст проекта выключен"}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
