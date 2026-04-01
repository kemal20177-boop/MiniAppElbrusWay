"use client";

import { FormEvent, useEffect, useState } from "react";

type Project = { id: string; title: string };
type Job = { id: string; status: string; createdAt: string; errorMessage?: string | null; output?: { fileId?: string; previewUrl?: string; attempts?: number } | null };
type FileRecord = { id: string; originalName: string; previewUrl: string | null };
type Capability = { available: boolean; modelId: string | null };

function presentStatus(status: string) {
  if (status === "PENDING") return "В очереди";
  if (status === "RUNNING") return "В обработке";
  if (status === "SUCCEEDED") return "Готово";
  if (status === "FAILED") return "Ошибка";
  if (status === "CANCELLED") return "Остановлено";
  return status;
}

export default function ImageToolPage() {
  const [mode, setMode] = useState<"text-to-image" | "image-to-image">("text-to-image");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [imageSize, setImageSize] = useState("1K");
  const [projectId, setProjectId] = useState("");
  const [sourceFileId, setSourceFileId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [images, setImages] = useState<FileRecord[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [resultFile, setResultFile] = useState<FileRecord | null>(null);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [activeJobId, setActiveJobId] = useState("");
  const [capability, setCapability] = useState<Capability>({ available: false, modelId: null });

  useEffect(() => {
    void Promise.all([loadProjects(), loadFiles(), loadJobs()]);
  }, []);

  async function loadProjects() {
    const response = await fetch("/api/projects");
    const payload = await response.json();
    if (response.ok) {
      setProjects(payload.data.projects || []);
    }
  }

  async function loadFiles() {
    const response = await fetch("/api/files?kind=IMAGE");
    const payload = await response.json();
    if (response.ok) {
      setImages(payload.data.files || []);
    }
  }

  async function loadJobs() {
    const response = await fetch("/api/tools/image");
    const payload = await response.json();
    if (response.ok) {
      setJobs(payload.data.jobs || []);
      setCapability(payload.data.capability || { available: false, modelId: null });
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResultFile(null);
    const response = await fetch("/api/tools/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        prompt,
        aspectRatio,
        imageSize,
        projectId: projectId || undefined,
        sourceFileId: mode === "image-to-image" ? sourceFileId || undefined : undefined
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось создать задание");
      return;
    }

    setActiveJobId(payload.data.job.id);
    setStatusMessage("Задание поставлено в очередь");
    setPrompt("");
  }

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
    setStatusMessage(action === "retry" ? "Задание поставлено в очередь повторно" : "Задание отменено");
    setActiveJobId(action === "retry" ? jobId : "");
    await loadJobs();
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

      const job = payload.data.job as Job;
      setStatusMessage(`Статус: ${job.status}`);
      if (job.status === "SUCCEEDED" && job.output?.fileId) {
        const fileResponse = await fetch(`/api/files/${job.output.fileId}`);
        const filePayload = await fileResponse.json();
        if (fileResponse.ok) {
          setResultFile(filePayload.data.file);
        }
        setActiveJobId("");
        await Promise.all([loadJobs(), loadFiles()]);
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

  return (
    <main className="workspace-page">
      <section className="panel workspace-panel">
        <div className="badge">Изображения</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Генерация изображений</h1>
        <p className="section-copy" style={{ maxWidth: 820 }}>
          Создавай иллюстрации по описанию, меняй готовые картинки и сохраняй результат в файлы проекта.
        </p>

        <div className="grid-3" style={{ marginTop: 24 }}>
          <form onSubmit={onSubmit} className="card" style={{ display: "grid", gap: 12, gridColumn: "span 2" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className={mode === "text-to-image" ? "button-primary" : "button-secondary"} onClick={() => setMode("text-to-image")}>Текст в изображение</button>
              <button type="button" className={mode === "image-to-image" ? "button-primary" : "button-secondary"} onClick={() => setMode("image-to-image")}>Редактирование изображения</button>
            </div>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={7} placeholder="Опиши изображение, стиль, сцену и артефакт для проекта" className="card" style={{ padding: 14 }} />
            <div className="grid-3">
              <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)} className="card" style={{ padding: 14 }}>
                <option value="1:1">1:1</option>
                <option value="2:3">2:3</option>
                <option value="3:2">3:2</option>
                <option value="3:4">3:4</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="4:3">4:3</option>
              </select>
              <select value={imageSize} onChange={(event) => setImageSize(event.target.value)} className="card" style={{ padding: 14 }}>
                <option value="1K">1K</option>
                <option value="2K">2K</option>
                <option value="4K">4K</option>
              </select>
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="card" style={{ padding: 14 }}>
                <option value="">Без проекта</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </select>
            </div>
            <div className="grid-3">
              <select value={sourceFileId} onChange={(event) => setSourceFileId(event.target.value)} className="card" style={{ padding: 14 }} disabled={mode !== "image-to-image"}>
                <option value="">Источник</option>
                {images.map((file) => <option key={file.id} value={file.id}>{file.originalName}</option>)}
              </select>
            </div>
            {error ? <div style={{ color: "var(--error)" }}>{error}</div> : null}
            {statusMessage ? <div className="muted">{statusMessage}</div> : null}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="button-primary" type="submit">Сгенерировать</button>
              <a className="button-secondary" href="/files">Открыть файлы</a>
              {resultFile ? <a className="button-secondary" href={`/projects/${projectId}`}>Открыть проект</a> : null}
            </div>
          </form>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Результат</h2>
            {resultFile?.previewUrl ? <img src={resultFile.previewUrl} alt={resultFile.originalName} style={{ width: "100%", borderRadius: 18, border: "1px solid var(--border)" }} /> : <div className="muted">Результат появится после завершения задания.</div>}
            {resultFile ? (
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                <div>{resultFile.originalName}</div>
                <a className="button-secondary" href="/documents">Открыть в документах</a>
              </div>
            ) : null}
          </div>
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <h2 style={{ marginTop: 0 }}>История</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {jobs.map((job) => (
              <div key={job.id} className="card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 700 }}>Запрос от {new Date(job.createdAt).toLocaleString("ru-RU")}</div>
                <div className="muted" style={{ marginTop: 6 }}>{presentStatus(job.status)}</div>
                {job.errorMessage ? <div className="muted" style={{ marginTop: 6 }}>{job.errorMessage}</div> : null}
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {job.status === "PENDING" || job.status === "RUNNING" ? <button className="button-secondary" type="button" onClick={() => void patchJob(job.id, "cancel")}>Остановить</button> : null}
                  {job.status === "FAILED" || job.status === "CANCELLED" ? <button className="button-secondary" type="button" onClick={() => void patchJob(job.id, "retry")}>Повторить</button> : null}
                </div>
              </div>
            ))}
            {jobs.length === 0 ? <div className="muted">Пока нет заданий.</div> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
