"use client";

import { FormEvent, useEffect, useState } from "react";

type CanvasVersion = {
  version: number;
  createdAt: string;
  content: string;
};

type CanvasItem = {
  id: string;
  title: string;
  currentContent: string;
  versions: CanvasVersion[];
};

type DiffPart = {
  added: boolean;
  removed: boolean;
  value: string;
};

export default function CanvasPage({ params }: { params: { id: string } }) {
  const [canvas, setCanvas] = useState<CanvasItem | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [diff, setDiff] = useState<DiffPart[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadCanvas();
  }, [params.id]);

  async function loadCanvas() {
    const response = await fetch(`/api/canvas/${params.id}`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось загрузить Canvas");
      return;
    }

    const nextCanvas = payload.data.canvas;
    setCanvas(nextCanvas);
    setTitle(nextCanvas.title);
    setContent(nextCanvas.currentContent);
  }

  async function saveCanvas(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/canvas/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось сохранить Canvas");
      return;
    }

    await loadCanvas();
  }

  async function loadDiff(fromVersion: number, toVersion: number) {
    const response = await fetch(`/api/canvas/${params.id}/diff?from=${fromVersion}&to=${toVersion}`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось построить diff");
      return;
    }

    setDiff(payload.data.diff || []);
  }

  const versions = canvas?.versions || [];

  return (
    <main className="workspace-page">
      <section className="panel workspace-panel">
        <div className="badge">Canvas</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>{canvas?.title || "Canvas"}</h1>
        {error ? <div style={{ color: "var(--error)", marginTop: 12 }}>{error}</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 0.9fr)", gap: 20, marginTop: 24 }}>
          <form className="card" onSubmit={saveCanvas} style={{ display: "grid", gap: 12 }}>
            <input value={title} onChange={(event) => setTitle(event.target.value)} style={{ width: "100%", minHeight: 46, borderRadius: 14, padding: "0 14px", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
            <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={24} className="card" style={{ padding: 14 }} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="button-primary" type="submit">Сохранить версию</button>
              <a className="button-secondary" href="/documents">Документы</a>
            </div>
          </form>

          <div style={{ display: "grid", gap: 20 }}>
            <div className="card">
              <h2 style={{ marginTop: 0 }}>История версий</h2>
              <div style={{ display: "grid", gap: 10 }}>
                {versions.map((version) => (
                  <button
                    key={version.version}
                    type="button"
                    className="card"
                    onClick={() => {
                      if (versions[0] && version.version !== versions[0].version) {
                        void loadDiff(version.version, versions[0].version);
                      }
                    }}
                    style={{ padding: 16, textAlign: "left" }}
                  >
                    <div style={{ fontWeight: 700 }}>v{version.version}</div>
                    <div className="muted">{new Date(version.createdAt).toLocaleString("ru-RU")}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <h2 style={{ marginTop: 0 }}>Diff</h2>
              <div style={{ maxHeight: 360, overflow: "auto", whiteSpace: "pre-wrap" }}>
                {diff.length === 0 ? <div className="muted">Выбери старую версию, чтобы сравнить с текущей.</div> : null}
                {diff.map((part, index) => (
                  <div
                    key={`${index}-${part.value}`}
                    style={{
                      background: part.added ? "rgba(34,197,94,0.14)" : part.removed ? "rgba(239,68,68,0.14)" : "transparent",
                      padding: "2px 6px",
                      borderRadius: 8
                    }}
                  >
                    {part.value}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
