"use client";

import { FormEvent, useState } from "react";

export default function DocumentsToolPage() {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const response = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, prompt })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось создать документ");
      return;
    }

    setMessage(`Документ создан: ${payload.data.document.title}`);
    setTitle("");
    setPrompt("");
  }

  return (
    <main className="workspace-page">
      <section className="panel workspace-panel">
        <div className="badge">Documents Tool</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Генерация документов</h1>
        <form onSubmit={onSubmit} className="card" style={{ marginTop: 24, display: "grid", gap: 12, maxWidth: 840 }}>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Название документа" style={{ width: "100%", minHeight: 46, borderRadius: 14, padding: "0 14px", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={10} placeholder="Задача, по которой нужно собрать документ" className="card" style={{ padding: 14 }} />
          {error ? <div style={{ color: "var(--error)" }}>{error}</div> : null}
          {message ? <div style={{ color: "var(--success)" }}>{message}</div> : null}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="button-primary" type="submit">Сгенерировать</button>
            <a className="button-secondary" href="/documents">Все документы</a>
          </div>
        </form>
      </section>
    </main>
  );
}
