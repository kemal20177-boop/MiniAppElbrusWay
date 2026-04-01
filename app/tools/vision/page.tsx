"use client";

import { useEffect, useState } from "react";

type UserFileItem = {
  id: string;
  originalName: string;
  mimeType: string;
  kind: string;
  previewUrl: string | null;
  metadata?: Record<string, unknown> | null;
};

export default function VisionPage() {
  const [files, setFiles] = useState<UserFileItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadFiles();
  }, []);

  async function loadFiles() {
    const response = await fetch("/api/files");
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось загрузить файлы");
      return;
    }

    const imageFiles = (payload.data.files || []).filter((entry: UserFileItem) => entry.kind === "IMAGE");
    setFiles(imageFiles);
    if (imageFiles[0]?.id) {
      setSelectedId(imageFiles[0].id);
    }
  }

  async function analyzeSelected() {
    if (!selectedId) {
      return;
    }

    const response = await fetch(`/api/files/${selectedId}/analyze`, {
      method: "POST"
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось проанализировать файл");
      return;
    }

    setResult(String(payload.data.analysis.summary || ""));
    await loadFiles();
  }

  const selected = files.find((entry) => entry.id === selectedId) || null;

  return (
    <main className="workspace-page">
      <section className="panel workspace-panel">
        <div className="badge">Vision</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>AI Vision</h1>
        <p className="section-copy" style={{ maxWidth: 820 }}>
          Сейчас vision-режим работает поверх загруженных изображений: просмотр, выбор файла и запуск анализа через files pipeline.
        </p>
        {error ? <div style={{ color: "var(--error)", marginTop: 12 }}>{error}</div> : null}

        <div className="grid-3" style={{ marginTop: 24 }}>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Изображения</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {files.map((file) => (
                <button key={file.id} type="button" className="card" onClick={() => setSelectedId(file.id)} style={{ padding: 16, textAlign: "left", background: file.id === selectedId ? "rgba(30,111,217,0.18)" : "rgba(255,255,255,0.03)" }}>
                  <div style={{ fontWeight: 700 }}>{file.originalName}</div>
                  <div className="muted" style={{ marginTop: 6 }}>{file.mimeType}</div>
                </button>
              ))}
              {files.length === 0 ? <div className="muted">Сначала загрузи изображения в разделе Files.</div> : null}
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 2" }}>
            <h2 style={{ marginTop: 0 }}>Анализ</h2>
            {!selected ? <div className="muted">Выбери изображение</div> : null}
            {selected ? (
              <div style={{ display: "grid", gap: 12 }}>
                {selected.previewUrl ? <img src={selected.previewUrl} alt={selected.originalName} style={{ width: "100%", maxHeight: 420, objectFit: "contain", borderRadius: 18, border: "1px solid var(--border)" }} /> : null}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="button-primary" type="button" onClick={() => void analyzeSelected()}>Запустить анализ</button>
                  <a className="button-secondary" href="/files">Файлы</a>
                </div>
                <div className="card" style={{ whiteSpace: "pre-wrap" }}>{result || "Результат анализа появится здесь."}</div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
