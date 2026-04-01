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
  }>;
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [sessions, setSessions] = useState<SearchSession[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadSessions();
  }, []);

  async function loadSessions() {
    const response = await fetch("/api/search");
    const payload = await response.json();
    if (response.ok) {
      setSessions(payload.data.sessions || []);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim() || loading) {
      return;
    }

    setLoading(true);
    setError("");
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        depth: "STANDARD"
      })
    });
    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error?.message || "Не удалось выполнить поиск");
      return;
    }

    setQuery("");
    await loadSessions();
  }

  const latest = sessions[0];

  return (
    <main className="workspace-page">
      <section className="panel workspace-panel">
        <div className="badge">Search</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Web Search</h1>
        <p className="section-copy" style={{ maxWidth: 820 }}>
          Поиск сохраняет сессию, список источников и текстовую сводку. Этот же инструмент используется в Chat Core как tool-aware режим.
        </p>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 24 }}>
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Что нужно найти?"
            rows={4}
            style={{ width: "100%", borderRadius: 18, padding: 16, background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          />
          {error ? <div style={{ color: "var(--error)" }}>{error}</div> : null}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="button-primary" type="submit" disabled={loading}>{loading ? "Ищем..." : "Найти источники"}</button>
            <a className="button-secondary" href="/chat">Открыть chat + web search</a>
          </div>
        </form>

        <div className="grid-3" style={{ marginTop: 24 }}>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>История</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {sessions.map((session) => (
                <div key={session.id} className="card" style={{ padding: 16 }}>
                  <div style={{ fontWeight: 700 }}>{session.query}</div>
                  <div className="muted" style={{ marginTop: 6 }}>{new Date(session.createdAt).toLocaleString("ru-RU")}</div>
                </div>
              ))}
              {sessions.length === 0 ? <div className="muted">Запросов пока нет</div> : null}
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 2" }}>
            <h2 style={{ marginTop: 0 }}>Последний результат</h2>
            {!latest ? <div className="muted">Сначала выполни запрос</div> : null}
            {latest ? (
              <div style={{ display: "grid", gap: 14 }}>
                <div className="card" style={{ whiteSpace: "pre-wrap" }}>{latest.answer || "Сводка не сформирована"}</div>
                <div style={{ display: "grid", gap: 10 }}>
                  {latest.sources.map((source, index) => (
                    <article key={source.id} className="card" style={{ padding: 16 }}>
                      <div style={{ fontWeight: 700 }}>[{index + 1}] {source.title}</div>
                      <div className="muted" style={{ margin: "8px 0" }}>{source.snippet || "Без сниппета"}</div>
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
