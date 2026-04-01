"use client";

import { FormEvent, useEffect, useState } from "react";

type CanvasItem = {
  id: string;
  title: string;
  currentContent: string;
  updatedAt: string;
  versions: Array<{ version: number; createdAt: string }>;
};

export default function CanvasIndexPage() {
  const [canvases, setCanvases] = useState<CanvasItem[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadCanvas();
  }, []);

  async function loadCanvas() {
    const response = await fetch("/api/canvas");
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось загрузить Canvas");
      return;
    }

    setCanvases(payload.data.canvases || []);
  }

  async function createCanvas(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/canvas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content,
        kind: "MARKDOWN"
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось создать Canvas");
      return;
    }

    setTitle("");
    setContent("");
    await loadCanvas();
  }

  return (
    <main className="workspace-page">
      <section className="panel workspace-panel">
        <div className="badge">Canvas</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Canvas workspace</h1>
        <p className="section-copy" style={{ maxWidth: 820 }}>
          Отдельные документы с версиями уже создаются, редактируются и доступны по прямому маршруту.
        </p>
        {error ? <div style={{ color: "var(--error)", marginTop: 12 }}>{error}</div> : null}

        <div className="grid-3" style={{ marginTop: 24 }}>
          <form className="card" onSubmit={createCanvas}>
            <h2 style={{ marginTop: 0 }}>Новый canvas</h2>
            <div style={{ display: "grid", gap: 10 }}>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Название" style={{ width: "100%", minHeight: 46, borderRadius: 14, padding: "0 14px", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={10} placeholder="Содержимое" className="card" style={{ padding: 14 }} />
              <button className="button-primary" type="submit">Создать</button>
            </div>
          </form>

          <div className="card" style={{ gridColumn: "span 2" }}>
            <h2 style={{ marginTop: 0 }}>Список canvas-документов</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {canvases.map((canvas) => (
                <a key={canvas.id} href={`/canvas/${canvas.id}`} className="card" style={{ padding: 16 }}>
                  <div style={{ fontWeight: 700 }}>{canvas.title}</div>
                  <div className="muted" style={{ marginTop: 6 }}>{new Date(canvas.updatedAt).toLocaleString("ru-RU")} · версий {canvas.versions.length}</div>
                  <div className="muted" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{canvas.currentContent.slice(0, 240)}</div>
                </a>
              ))}
              {canvases.length === 0 ? <div className="muted">Canvas-документов пока нет</div> : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
