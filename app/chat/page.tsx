"use client";

import { FormEvent, useEffect, useState } from "react";
import { defaultModelId } from "@/lib/site";

type ChatSummary = {
  id: string;
  title: string;
  model: string;
  updatedAt: string;
};

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ModelOption = {
  id: string;
  name: string;
  provider: string;
  pricing: {
    prompt?: number;
    completion?: number;
  } | null;
  contextLength: number | null;
  supportsImages: boolean;
  supportsFiles: boolean;
  supportsAudio: boolean;
  supportsVideo: boolean;
  supportsWebSearch: boolean;
  supportsReasoning: boolean;
  supportsTools: boolean;
};

const featuredMatchers = [
  /chatgpt|gpt-4o|gpt-4\.1/i,
  /nanobanana|banana/i,
  /grok/i,
  /veo/i,
  /sora/i,
  /solla|suno/i,
  /deepseek-chat|deepseek/i
];

const categoryOrder = [
  { id: "top", label: "Топ 7" },
  { id: "chat", label: "Чат" },
  { id: "image", label: "Изображения" },
  { id: "video", label: "Видео" },
  { id: "coding", label: "Программирование" },
  { id: "audio", label: "Аудио" }
] as const;

function inferModelCategory(model: ModelOption) {
  const haystack = `${model.id} ${model.name}`.toLowerCase();

  if (model.supportsVideo || /video|veo|sora|kling|seedance|runway/.test(haystack)) {
    return "video";
  }

  if (model.supportsAudio || /audio|speech|tts|whisper|voice|suno|solla/.test(haystack)) {
    return "audio";
  }

  if (model.supportsImages || /image|flux|banana|nano|midjourney|recraft/.test(haystack)) {
    return "image";
  }

  if (/code|coder|program|claude|gpt-4\.1|deepseek-coder|qwen.*coder/.test(haystack)) {
    return "coding";
  }

  return "chat";
}

function pickFeaturedModels(models: ModelOption[]) {
  const picked: ModelOption[] = [];

  for (const matcher of featuredMatchers) {
    const match = models.find((model) => matcher.test(`${model.id} ${model.name}`) && !picked.some((entry) => entry.id === model.id));
    if (match) {
      picked.push(match);
    }
  }

  for (const model of models) {
    if (picked.length >= 7) {
      break;
    }

    if (!picked.some((entry) => entry.id === model.id)) {
      picked.push(model);
    }
  }

  return picked.slice(0, 7);
}

function formatPricePerMillion(value?: number) {
  if (typeof value !== "number") {
    return "n/a";
  }

  return `${(value * 1_000_000).toFixed(value * 1_000_000 >= 1 ? 2 : 4)} ₽`;
}

export default function ChatPage() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState(defaultModelId);
  const [chatId, setChatId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState<(typeof categoryOrder)[number]["id"]>("top");

  useEffect(() => {
    void loadModels();
    void loadChats();
    void loadProfile();
  }, []);

  const activeModel = models.find((entry) => entry.id === selectedModel);
  const featuredModels = pickFeaturedModels(models);
  const filteredModels =
    activeCategory === "top"
      ? featuredModels
      : models.filter((model) => inferModelCategory(model) === activeCategory);

  async function loadChats() {
    const response = await fetch("/api/chats");
    const payload = await response.json();
    if (!response.ok) {
      setError("Войдите, чтобы работать с чатами");
      return;
    }

    setChats(payload.chats);
    if (payload.chats[0]) {
      void openChat(payload.chats[0].id);
    }
  }

  async function loadProfile() {
    const response = await fetch("/api/user/profile");
    const payload = await response.json();
    if (response.ok) {
      setTokenBalance(payload.user.tokenBalance);
    }
  }

  async function loadModels() {
    const response = await fetch("/api/models");
    const payload = await response.json();
    if (!response.ok || !Array.isArray(payload.data)) {
      return;
    }

    setModels(payload.data);
    if (payload.data.some((entry: ModelOption) => entry.id === selectedModel)) {
      return;
    }

    if (payload.data[0]?.id) {
      setSelectedModel(payload.data[0].id);
    }
  }

  async function openChat(id: string) {
    const response = await fetch(`/api/chats/${id}/messages`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.message || "Не удалось загрузить чат");
      return;
    }

    setChatId(id);
    setMessages(payload.messages.map((entry: { role: ChatMessage["role"]; content: string }) => ({
      role: entry.role,
      content: entry.content
    })));
  }

  async function createChat() {
    const response = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: selectedModel })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.message || "Не удалось создать чат");
      return;
    }

    setChats((prev) => [payload.chat, ...prev]);
    setChatId(payload.chat.id);
    setMessages([]);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || loading) {
      return;
    }

    setError("");
    const previousMessages = messages;
    const nextMessages = [...messages, { role: "user" as const, content: input }, { role: "assistant" as const, content: "" }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const requestMessages = nextMessages
        .filter((message, index) => !(index === nextMessages.length - 1 && message.role === "assistant" && !message.content))
        .map((message) => ({
          role: message.role,
          content: message.content
        }));
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          model: selectedModel,
          messages: requestMessages
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

          const eventLine = block.split("\n").find((line) => line.startsWith("event:"));
          const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
          if (!eventLine || !dataLine) {
            continue;
          }

          const eventType = eventLine.slice(6).trim();
          const payload = JSON.parse(dataLine.slice(5).trim()) as Record<string, unknown>;

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

  return (
    <main className="shell" style={{ padding: "18px 0 56px" }}>
      <div className="panel" style={{ padding: 24, minHeight: "72vh" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 34 }}>Чат</h1>
            <div className="muted">Актуальный каталог RouterAI, сохранение истории, списание токенов и живой баланс.</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span className="badge">{activeModel?.name || selectedModel}</span>
            <span className="badge">RouterAI</span>
            <span className="badge">Баланс: {tokenBalance ?? "..."}</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: 18 }}>
          <aside className="card" style={{ display: "grid", gap: 12, alignContent: "start" }}>
            <button className="button-primary" onClick={() => void createChat()}>+ Новый чат</button>
            {chats.map((item) => (
              <button
                key={item.id}
                type="button"
                className="card"
                onClick={() => void openChat(item.id)}
                style={{
                  padding: 16,
                  textAlign: "left",
                  background: item.id === chatId ? "rgba(30,111,217,0.18)" : "rgba(255,255,255,0.03)"
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{item.title}</div>
                <div className="muted" style={{ fontSize: 14 }}>{new Date(item.updatedAt).toLocaleString("ru-RU")}</div>
              </button>
            ))}
          </aside>

          <section className="card" style={{ display: "grid", gridTemplateRows: "1fr auto", minHeight: 520 }}>
            <div style={{ display: "grid", gap: 14, alignContent: "start", paddingBottom: 18 }}>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {categoryOrder.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={activeCategory === category.id ? "button-primary" : "button-ghost"}
                      onClick={() => setActiveCategory(category.id)}
                      style={{ minHeight: 38 }}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="muted">Модель</span>
                  <select
                    value={selectedModel}
                    onChange={(event) => setSelectedModel(event.target.value)}
                    style={{
                      width: "100%",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.03)",
                      color: "var(--text-primary)",
                      padding: 12
                    }}
                  >
                    {filteredModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.provider} · {model.name}
                      </option>
                    ))}
                  </select>
                </label>
                {activeCategory === "top" ? (
                  <div className="muted" style={{ fontSize: 14 }}>
                    Быстрый доступ к самым востребованным моделям. Для остальных переключай категорию выше.
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: 14 }}>
                    Показано моделей в категории: {filteredModels.length}
                  </div>
                )}
                {activeModel ? (
                  <div className="muted" style={{ fontSize: 14 }}>
                    In: {formatPricePerMillion(activeModel.pricing?.prompt)} / 1M · Out:{" "}
                    {formatPricePerMillion(activeModel.pricing?.completion)} / 1M · Контекст:{" "}
                    {activeModel.contextLength?.toLocaleString("ru-RU") || "n/a"}
                  </div>
                ) : null}
              </div>
              {messages.length === 0 ? (
                <div className="muted">Создайте чат или отправьте первое сообщение.</div>
              ) : null}
              {messages.map((message, index) => (
                <article
                  key={`${message.role}-${index}`}
                  style={{
                    justifySelf: message.role === "user" ? "end" : "start",
                    maxWidth: "80%",
                    padding: "16px 18px",
                    borderRadius: 18,
                    background:
                      message.role === "user"
                        ? "linear-gradient(135deg, rgba(30,111,217,0.9), rgba(0,200,232,0.65))"
                        : "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    whiteSpace: "pre-wrap"
                  }}
                >
                  {message.content}
                </article>
              ))}
            </div>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Напишите сообщение..."
                rows={5}
                style={{
                  width: "100%",
                  resize: "vertical",
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                  color: "var(--text-primary)",
                  padding: 16
                }}
              />
              {error ? <div style={{ color: "var(--error)" }}>{error}</div> : null}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div className="muted">
                  {activeModel
                    ? [
                        activeModel.supportsImages ? "image" : null,
                        activeModel.supportsFiles ? "file" : null,
                        activeModel.supportsAudio ? "audio" : null,
                        activeModel.supportsVideo ? "video" : null,
                        activeModel.supportsWebSearch ? "web-search" : null,
                        activeModel.supportsReasoning ? "reasoning" : null,
                        activeModel.supportsTools ? "tools" : null
                      ]
                        .filter(Boolean)
                        .join(" · ") || "text-only"
                    : "Загрузка каталога моделей..."}
                </div>
                <button type="submit" className="button-primary" disabled={loading || models.length === 0}>
                  {loading ? "Генерация..." : "Отправить"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
