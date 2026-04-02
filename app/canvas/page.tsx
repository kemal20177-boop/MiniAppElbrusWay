"use client";

import Link from "next/link";
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
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      await loadCanvas();
    })();
  }, []);

  async function loadCanvas() {
    const response = await fetch("/api/canvas");
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось загрузить редакторские заметки");
      return;
    }
    setCanvases(payload.data.canvases || []);
  }

  async function createCanvas(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
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
      setError(payload.error?.message || "Не удалось создать заметку");
      return;
    }
    setTitle("");
    setContent("");
    setMessage("Новая заметка создана");
    await loadCanvas();
  }

  return (
    <div className="page-stack">
      <section className="surface">
        <div className="eyebrow">Редактор</div>
        <h1 className="surface-title">Создавайте живые рабочие заметки, которые можно редактировать и хранить по версиям.</h1>
        <p className="surface-copy">Редактор подходит для черновиков, текстов, технических заметок и промежуточных материалов.</p>
      </section>

      <div className="content-grid two-columns">
        <section className="surface">
          <div className="eyebrow">Новая заметка</div>
          <h2 className="surface-title">Начать с пустого листа</h2>
          <form onSubmit={createCanvas} className="section-stack">
            <label className="field">
              <span>Название</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например: План презентации" />
            </label>
            <label className="field">
              <span>Содержимое</span>
              <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={10} placeholder="Начните писать заметку, план, черновик или структуру." />
            </label>
            {error ? <div className="error-banner">{error}</div> : null}
            {message ? <div className="success-banner">{message}</div> : null}
            <button className="button-primary" type="submit">
              Создать заметку
            </button>
          </form>
        </section>

        <section className="surface">
          <div className="eyebrow">Список</div>
          <h2 className="surface-title">Последние заметки</h2>
          <div className="status-list">
            {canvases.map((canvas) => (
              <Link key={canvas.id} href={`/canvas/${canvas.id}`} className="status-card">
                <strong>{canvas.title}</strong>
                <span className="muted-text">
                  Обновлено {new Date(canvas.updatedAt).toLocaleString("ru-RU")} · версий {canvas.versions.length}
                </span>
                <span className="muted-text">{canvas.currentContent.slice(0, 220)}</span>
              </Link>
            ))}
            {canvases.length === 0 ? <div className="muted-text">Пока нет заметок.</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
