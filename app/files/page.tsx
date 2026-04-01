"use client";

import { ChangeEvent, useEffect, useState } from "react";

type UserFileItem = {
  id: string;
  originalName: string;
  mimeType: string;
  kind: string;
  status: string;
  sizeBytes: number;
  extractedText: string | null;
  previewUrl: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export default function FilesPage() {
  const [files, setFiles] = useState<UserFileItem[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [analysis, setAnalysis] = useState<string>("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

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

    setFiles(payload.data.files || []);
    if (!selectedFileId && payload.data.files?.[0]?.id) {
      setSelectedFileId(payload.data.files[0].id);
    }
  }

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const upload = event.target.files?.[0];
    if (!upload) {
      return;
    }

    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", upload);

    const response = await fetch("/api/files", {
      method: "POST",
      body: formData
    });
    const payload = await response.json();
    setUploading(false);

    if (!response.ok) {
      setError(payload.error?.message || "Не удалось загрузить файл");
      return;
    }

    setSelectedFileId(payload.data.file.id);
    await loadFiles();
  }

  async function runAnalysis(fileId: string) {
    setError("");
    const response = await fetch(`/api/files/${fileId}/analyze`, {
      method: "POST"
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось проанализировать файл");
      return;
    }

    setAnalysis(String(payload.data.analysis.summary || ""));
    await loadFiles();
  }

  async function removeFile(fileId: string) {
    const response = await fetch(`/api/files/${fileId}`, {
      method: "DELETE"
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось удалить файл");
      return;
    }

    if (selectedFileId === fileId) {
      setSelectedFileId("");
      setAnalysis("");
    }
    await loadFiles();
  }

  const selectedFile = files.find((entry) => entry.id === selectedFileId) || null;
  const selectedAnalysis = (selectedFile?.metadata as Record<string, unknown> | null)?.analysis as Record<string, unknown> | undefined;

  return (
    <main className="workspace-page">
      <section className="panel workspace-panel">
        <div className="badge">Files</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Файлы и анализ</h1>
        <p className="section-copy" style={{ maxWidth: 820 }}>
          Загрузка, хранение, текстовое извлечение, chunking и быстрый анализ уже работают через backend storage.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
          <label className="button-primary" style={{ cursor: "pointer" }}>
            {uploading ? "Загрузка..." : "Загрузить файл"}
            <input type="file" hidden onChange={onUpload} />
          </label>
          <a className="button-secondary" href="/tools/vision">Открыть Vision</a>
          <a className="button-secondary" href="/chat">Открыть Chat Core</a>
        </div>

        {error ? <div style={{ color: "var(--error)", marginTop: 14 }}>{error}</div> : null}

        <div className="grid-3" style={{ marginTop: 24 }}>
          <div className="card" style={{ gridColumn: "span 1", display: "grid", gap: 12 }}>
            <h2 style={{ margin: 0 }}>Список файлов</h2>
            {files.length === 0 ? <div className="muted">Файлов пока нет</div> : null}
            {files.map((file) => (
              <button
                key={file.id}
                type="button"
                className="card"
                onClick={() => setSelectedFileId(file.id)}
                style={{
                  padding: 16,
                  textAlign: "left",
                  background: file.id === selectedFileId ? "rgba(30,111,217,0.18)" : "rgba(255,255,255,0.03)"
                }}
              >
                <div style={{ fontWeight: 700 }}>{file.originalName}</div>
                <div className="muted" style={{ marginTop: 6 }}>{file.kind} · {file.status} · {file.sizeBytes} bytes</div>
              </button>
            ))}
          </div>

          <div className="card" style={{ gridColumn: "span 2" }}>
            <h2 style={{ marginTop: 0 }}>Карточка файла</h2>
            {!selectedFile ? <div className="muted">Выберите файл слева</div> : null}
            {selectedFile ? (
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 20 }}>{selectedFile.originalName}</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {selectedFile.mimeType} · {selectedFile.kind} · {new Date(selectedFile.createdAt).toLocaleString("ru-RU")}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="button-primary" type="button" onClick={() => void runAnalysis(selectedFile.id)}>
                    Проанализировать
                  </button>
                  {selectedFile.previewUrl ? (
                    <a className="button-secondary" href={selectedFile.previewUrl} target="_blank" rel="noreferrer">
                      Открыть контент
                    </a>
                  ) : null}
                  <button className="button-ghost" type="button" onClick={() => void removeFile(selectedFile.id)}>
                    Удалить
                  </button>
                </div>
                <div className="card" style={{ whiteSpace: "pre-wrap" }}>
                  {analysis || String(selectedAnalysis?.summary || selectedFile.extractedText?.slice(0, 4000) || "Текстовое содержимое пока недоступно")}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
