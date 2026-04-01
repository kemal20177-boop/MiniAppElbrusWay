"use client";

import { FormEvent, useEffect, useState } from "react";

type UserFileItem = {
  id: string;
  originalName: string;
  mimeType: string;
  kind: string;
  previewUrl: string | null;
};

type VisionJob = {
  id: string;
  status: string;
  createdAt: string;
  errorMessage?: string | null;
  output?: Record<string, unknown> | null;
};
type Capability = { available: boolean; modelId: string | null };

const modes = [
  { id: "ocr", label: "OCR" },
  { id: "describe", label: "Описание" },
  { id: "screenshot-analysis", label: "Анализ скриншота" },
  { id: "chart-analysis", label: "Анализ графика" },
  { id: "ask", label: "Вопрос по изображению" }
] as const;

export default function VisionPage() {
  const [files, setFiles] = useState<UserFileItem[]>([]);
  const [jobs, setJobs] = useState<VisionJob[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [mode, setMode] = useState<(typeof modes)[number]["id"]>("describe");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [activeJobId, setActiveJobId] = useState("");
  const [capability, setCapability] = useState<Capability>({ available: false, modelId: null });

  async function patchJob(jobId: string, action: "retry" | "cancel") {
    const response = await fetch(`/api/tools/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось обновить задание");
      return;
    }
    setActiveJobId(action === "retry" ? jobId : "");
    await loadJobs();
  }

  useEffect(() => {
    void Promise.all([loadFiles(), loadJobs()]);
  }, []);

  async function loadFiles() {
    const response = await fetch("/api/files?kind=IMAGE");
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось загрузить файлы");
      return;
    }

    const imageFiles = payload.data.files || [];
    setFiles(imageFiles);
    if (imageFiles[0]?.id) {
      setSelectedId((current) => current || imageFiles[0].id);
    }
  }

  async function loadJobs() {
    const response = await fetch("/api/tools/vision");
    const payload = await response.json();
    if (response.ok) {
      setJobs(payload.data.jobs || []);
      setCapability(payload.data.capability || { available: false, modelId: null });
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) {
      return;
    }

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
      setError(payload.error?.message || "Не удалось выполнить анализ изображения");
      return;
    }

    setActiveJobId(payload.data.job.id);
  }

  useEffect(() => {
    if (!activeJobId) {
      return;
    }

    const timer = setInterval(async () => {
      const response = await fetch(`/api/tools/jobs/${activeJobId}`);
      const payload = await response.json();
      if (!response.ok) {
        return;
      }
      const job = payload.data.job as VisionJob;
      if (job.status === "SUCCEEDED") {
        setResult((job.output?.result as Record<string, unknown>) || null);
        setActiveJobId("");
        await loadJobs();
      } else if (job.status === "FAILED" || job.status === "CANCELLED") {
        setError(job.errorMessage || "Задание завершилось с ошибкой");
        setActiveJobId("");
        await loadJobs();
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [activeJobId]);

  useEffect(() => {
    void loadJobs();
  }, []);

  const selected = files.find((entry) => entry.id === selectedId) || null;

  return (
    <main className="workspace-page">
      <section className="panel workspace-panel">
        <div className="badge">Зрение</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Анализ изображений</h1>
        <p className="section-copy" style={{ maxWidth: 820 }}>
          Страница помогает извлекать текст, описывать изображения, разбирать скриншоты и графики, а также задавать вопросы по картинке через RouterAI.
        </p>
        <div className="muted" style={{ marginTop: 12 }}>Модель RouterAI: {capability.modelId || "недоступна"}</div>
        {error ? <div style={{ color: "var(--error)", marginTop: 12 }}>{error}</div> : null}

        <div className="grid-3" style={{ marginTop: 24 }}>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Библиотека изображений</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {files.map((file) => (
                <button key={file.id} type="button" className="card" onClick={() => setSelectedId(file.id)} style={{ padding: 16, textAlign: "left", background: file.id === selectedId ? "rgba(30,111,217,0.18)" : "rgba(255,255,255,0.03)" }}>
                  <div style={{ fontWeight: 700 }}>{file.originalName}</div>
                  <div className="muted" style={{ marginTop: 6 }}>{file.mimeType}</div>
                </button>
              ))}
              {files.length === 0 ? <div className="muted">Сначала загрузи изображения в файлы.</div> : null}
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 2" }}>
            <h2 style={{ marginTop: 0 }}>Запуск анализа</h2>
            {!selected ? <div className="muted">Выбери изображение</div> : null}
            {selected ? (
              <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
                {selected.previewUrl ? <img src={selected.previewUrl} alt={selected.originalName} style={{ width: "100%", maxHeight: 360, objectFit: "contain", borderRadius: 18, border: "1px solid var(--border)" }} /> : null}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {modes.map((entry) => (
                    <button key={entry.id} type="button" className={mode === entry.id ? "button-primary" : "button-secondary"} onClick={() => setMode(entry.id)}>
                      {entry.label}
                    </button>
                  ))}
                </div>
                {mode === "ask" ? <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={4} placeholder="Что нужно понять по изображению?" className="card" style={{ padding: 14 }} /> : null}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="button-primary" type="submit">Запустить анализ</button>
                  <a className="button-secondary" href="/files">Открыть файлы</a>
                </div>
                <pre className="card" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{result ? JSON.stringify(result, null, 2) : "Структурированный результат появится здесь."}</pre>
              </form>
            ) : null}
          </div>
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <h2 style={{ marginTop: 0 }}>История</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {jobs.map((job) => (
              <div key={job.id} className="card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 700 }}>{job.id}</div>
                <div className="muted" style={{ marginTop: 6 }}>{job.status} · {new Date(job.createdAt).toLocaleString("ru-RU")}</div>
                {job.errorMessage ? <div className="muted" style={{ marginTop: 6 }}>{job.errorMessage}</div> : null}
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {job.status === "PENDING" || job.status === "RUNNING" ? <button className="button-secondary" type="button" onClick={() => void patchJob(job.id, "cancel")}>Отменить</button> : null}
                  {job.status === "FAILED" || job.status === "CANCELLED" ? <button className="button-secondary" type="button" onClick={() => void patchJob(job.id, "retry")}>Повторить</button> : null}
                </div>
              </div>
            ))}
            {jobs.length === 0 ? <div className="muted">Пока нет запусков.</div> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
