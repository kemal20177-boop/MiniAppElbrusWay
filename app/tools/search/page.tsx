"use client";

import { FormEvent, useEffect, useState } from "react";

type SearchSession = {
  id: string;
  query: string;
  answer: string | null;
  createdAt: string;
  sources: Array<{
    id: string;
    title: string;
    url: string;
    snippet: string | null;
    domain?: string | null;
  }>;
};

const depthMap = {
  fast: "SHORT",
  standard: "STANDARD",
  deep: "DEEP"
} as const;

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [depth, setDepth] = useState<keyof typeof depthMap>("standard");
  const [latestOnly, setLatestOnly] = useState(false);
  const [sessions, setSessions] = useState<SearchSession[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    void loadSessions();
  }, []);

  async function loadSessions() {
    const response = await fetch("/api/search");
    const payload = await response.json();
    if (response.ok) {
      const nextSessions = payload.data.sessions || [];
      setSessions(nextSessions);
      if (nextSessions[0]?.id) {
        setSelectedId((current) => current || nextSessions[0].id);
      }
    }
  }

  async function runSearch(body: Record<string, unknown>) {
    setLoading(true);
    setError("");
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error?.message || "Не удалось выполнить поиск");
      return;
    }

    await loadSessions();
    setQuery("");
    setFollowUp("");
  }

  async function openInCanvas(session: SearchSession) {
    setActionMessage("");
    const response = await fetch("/api/canvas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Search: ${session.query}`,
        content: `${session.answer || ""}\n\n${session.sources.map((source, index) => `[${index + 1}] ${source.title}\n${source.url}\n${source.snippet || ""}`).join("\n\n")}`
      })
    });
    const payload = await response.json();
    if (response.ok) {
      window.location.href = `/canvas/${payload.data.canvas.id}`;
      return;
    }
    setActionMessage(payload.error?.message || "Не удалось открыть результат в canvas");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim() || loading) {
      return;
    }

    await runSearch({
      query,
      latestOnly,
      depth: depthMap[depth]
    });
  }

  async function onFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!followUp.trim() || !selectedId || loading) {
      return;
    }

    await runSearch({
      query: followUp,
      sessionId: selectedId,
      latestOnly,
      depth: depthMap[depth]
    });
  }

  const selected = sessions.find((session) => session.id === selectedId) || sessions[0] || null;

  return (
    <main className="workspace-page">
      <section className="panel workspace-panel">
        <div className="badge">Поиск</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Поиск по веб-источникам</h1>
        <p className="section-copy" style={{ maxWidth: 820 }}>
          Поиск сохраняет сессии, источники и уточнения по теме, а глубокий режим подтягивает больше контекста со страниц вместо одного сниппета.
        </p>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 24 }}>
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Что нужно найти?"
            rows={4}
            style={{ width: "100%", borderRadius: 18, padding: 16, background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {(["fast", "standard", "deep"] as const).map((entry) => (
              <button key={entry} type="button" className={depth === entry ? "button-primary" : "button-secondary"} onClick={() => setDepth(entry)}>
                {entry === "fast" ? "Быстро" : entry === "standard" ? "Стандарт" : "Глубоко"}
              </button>
            ))}
            <label className="button-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={latestOnly} onChange={(event) => setLatestOnly(event.target.checked)} />
              Только свежее
            </label>
          </div>
          {error ? <div style={{ color: "var(--error)" }}>{error}</div> : null}
          {actionMessage ? <div className="muted">{actionMessage}</div> : null}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="button-primary" type="submit" disabled={loading}>{loading ? "Ищем..." : "Найти источники"}</button>
            <a className="button-secondary" href="/chat">Открыть чат с поиском</a>
          </div>
        </form>

        <div className="grid-3" style={{ marginTop: 24 }}>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Сессии</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {sessions.map((session) => (
                <button key={session.id} type="button" className="card" onClick={() => setSelectedId(session.id)} style={{ padding: 16, textAlign: "left", background: session.id === selectedId ? "rgba(30,111,217,0.18)" : "rgba(255,255,255,0.03)" }}>
                  <div style={{ fontWeight: 700 }}>{session.query}</div>
                  <div className="muted" style={{ marginTop: 6 }}>{new Date(session.createdAt).toLocaleString("ru-RU")}</div>
                </button>
              ))}
              {sessions.length === 0 ? <div className="muted">Запросов пока нет</div> : null}
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 2" }}>
            <h2 style={{ marginTop: 0 }}>Выбранный результат</h2>
            {!selected ? <div className="muted">Сначала выполни запрос</div> : null}
            {selected ? (
              <div style={{ display: "grid", gap: 14 }}>
                <div className="card" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{selected.answer || "Сводка не сформирована"}</div>
                <form onSubmit={onFollowUp} style={{ display: "grid", gap: 10 }}>
                  <textarea value={followUp} onChange={(event) => setFollowUp(event.target.value)} rows={3} placeholder="Уточнение по этой же поисковой сессии" className="card" style={{ padding: 14 }} />
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button className="button-primary" type="submit" disabled={!selectedId || loading}>Запустить уточнение</button>
                    <a className="button-secondary" href={`/tools/documents?query=${encodeURIComponent(selected.query)}`}>Создать документ</a>
                    <button className="button-secondary" type="button" onClick={() => void openInCanvas(selected)}>Открыть в канвасе</button>
                  </div>
                </form>
                <div style={{ display: "grid", gap: 10 }}>
                  {selected.sources.map((source, index) => (
                    <article key={source.id} className="card" style={{ padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <div style={{ fontWeight: 700 }}>[{index + 1}] {source.title}</div>
                        <span className="badge">{source.domain || "веб-источник"}</span>
                      </div>
                      <div style={{ margin: "10px 0", whiteSpace: "pre-wrap" }}>{source.snippet || "Без сниппета"}</div>
                      <div className="muted" style={{ marginBottom: 10 }}>{source.url}</div>
                      <a href={source.url} target="_blank" rel="noreferrer" className="button-secondary">Открыть источник</a>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
