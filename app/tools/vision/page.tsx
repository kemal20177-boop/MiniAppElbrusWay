"use client";

import { FormEvent, useEffect, useState } from "react";

type UserFileItem = {
  id: string;
  originalName: string;
  previewUrl: string | null;
};

type VisionJob = {
  id: string;
  status: string;
  createdAt: string;
  errorMessage?: string | null;
  output?: Record<string, unknown> | null;
};

const modes = [
  { id: "describe", label: "Кратко описать" },
  { id: "ocr", label: "Вытащить текст" },
  { id: "screenshot-analysis", label: "Разобрать скриншот" },
  { id: "chart-analysis", label: "Разобрать график" },
  { id: "ask", label: "Ответить на вопрос" }
] as const;

function presentStatus(status: string) {
  if (status === "PENDING") return "В очереди";
  if (status === "RUNNING") return "Анализируем";
  if (status === "SUCCEEDED") return "Готово";
  if (status === "FAILED") return "Ошибка";
  if (status === "CANCELLED") return "Остановлено";
  return status;
}

export default function VisionPage() {
  const [files, setFiles] = useState<UserFileItem[]>([]);
  const [jobs, setJobs] = useState<VisionJob[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [mode, setMode] = useState<(typeof modes)[number]["id"]>("describe");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [activeJobId, setActiveJobId] = useState("");

  useEffect(() => {
    void Promise.all([loadFiles(), loadJobs()]);
  }, []);

  useEffect(() => {
    if (!activeJobId) return;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/tools/jobs/${activeJobId}`);
      const payload = await response.json();
      if (!response.ok) return;
      const job = payload.data.job as VisionJob;
      if (job.status === "SUCCEEDED") {
        setResult((job.output?.result as Record<string, unknown>) || null);
        setActiveJobId("");
        await loadJobs();
      }
      if (job.status === "FAILED" || job.status === "CANCELLED") {
        setError(job.errorMessage || "Не удалось завершить анализ");
        setActiveJobId("");
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [activeJobId]);

  async function loadFiles() {
    const response = await fetch("/api/files?kind=IMAGE");
    const payload = await response.json();
    if (!response.ok) return;
    const nextFiles = payload.data.files || [];
    setFiles(nextFiles);
    if (nextFiles[0]?.id) {
      setSelectedId((current) => current || nextFiles[0].id);
    }
  }

  async function loadJobs() {
    const response = await fetch("/api/tools/vision");
    const payload = await response.json();
    if (response.ok) setJobs(payload.data.jobs || []);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/tools/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        sourceFileId: selectedId,
        question: mode === "ask" ? question : undefined
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.message || "Не удалось запустить анализ");
      return;
    }
    setActiveJobId(payload.data.job.id);
  }

  const selected = files.find((entry) => entry.id === selectedId) || null;

  return (
    <div className="page-stack">
      <section className="surface">
        <div className="eyebrow">Анализ изображений</div>
        <h1 className="surface-title">Поймите, что находится на картинке, без сложных настроек.</h1>
        <p className="surface-copy">Можно получить описание, вытащить текст, разобрать интерфейс, график или задать конкретный вопрос по изображению.</p>
      </section>

      <div className="media-grid">
        <section className="surface">
          <div className="feature-list">
            {files.map((file) => (
              <button key={file.id} type="button" className={file.id === selectedId ? "chat-list-card active" : "chat-list-card"} onClick={() => setSelectedId(file.id)}>
                <strong>{file.originalName}</strong>
              </button>
            ))}
            {files.length === 0 ? <div className="muted-text">Сначала загрузите изображение в раздел файлов.</div> : null}
          </div>
        </section>

        <section className="surface">
          {selected ? (
            <form onSubmit={onSubmit} className="section-stack">
              {selected.previewUrl ? (
                <div className="preview-frame">
                  <img src={selected.previewUrl} alt={selected.originalName} />
                </div>
              ) : null}
              <div className="family-row">
                {modes.map((entry) => (
                  <button key={entry.id} type="button" className={mode === entry.id ? "chip chip-active" : "chip"} onClick={() => setMode(entry.id)}>
                    {entry.label}
                  </button>
                ))}
              </div>
              {mode === "ask" ? (
                <label className="field">
                  <span>Вопрос</span>
                  <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Например: что написано на экране и где главная проблема?" />
                </label>
              ) : null}
              {error ? <div className="error-banner">{error}</div> : null}
              <div className="toolbar-row">
                <button className="button-primary" type="submit">
                  Запустить анализ
                </button>
                <a href="/files" className="button-secondary">
                  Открыть файлы
                </a>
              </div>
              <pre className="status-card" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {result ? JSON.stringify(result, null, 2) : "Результат анализа появится здесь."}
              </pre>
            </form>
          ) : (
            <div className="muted-text">Выберите изображение слева.</div>
          )}
        </section>
      </div>

      <section className="surface">
        <div className="eyebrow">История</div>
        <h2 className="surface-title">Последние анализы</h2>
        <div className="status-list">
          {jobs.map((job) => (
            <div key={job.id} className="status-card">
              <strong>{new Date(job.createdAt).toLocaleString("ru-RU")}</strong>
              <span className="muted-text">{presentStatus(job.status)}</span>
              {job.errorMessage ? <span className="muted-text">{job.errorMessage}</span> : null}
            </div>
          ))}
          {jobs.length === 0 ? <div className="muted-text">История появится после первого анализа.</div> : null}
        </div>
      </section>
    </div>
  );
}
