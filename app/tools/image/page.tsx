"use client";

import { FormEvent, useEffect, useState } from "react";

type Project = { id: string; title: string };
type Job = { id: string; status: string; createdAt: string; output?: { fileId?: string } | null };
type FileRecord = { id: string; originalName: string; previewUrl: string | null };

export default function ImageToolPage() {
  const [mode, setMode] = useState<"text-to-image" | "image-to-image">("text-to-image");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [projectId, setProjectId] = useState("");
  const [sourceFileId, setSourceFileId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [images, setImages] = useState<FileRecord[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [resultFile, setResultFile] = useState<FileRecord | null>(null);
  const [error, setError] = useState("");

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
        projectId: projectId || undefined,
        sourceFileId: mode === "image-to-image" ? sourceFileId || undefined : undefined
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось создать image job");
      return;
    }

    setResultFile(payload.data.file || null);
    setPrompt("");
    await Promise.all([loadJobs(), loadFiles()]);
  }

  return (
    <main className="workspace-page">
      <section className="panel workspace-panel">
        <div className="badge">Image</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Image Generation</h1>
        <p className="section-copy" style={{ maxWidth: 820 }}>
          Реальный image tool page поверх `ApiJob`: text-to-image, image-to-image, сохранение результата как project file и быстрые переходы в workspace.
        </p>

        <div className="grid-3" style={{ marginTop: 24 }}>
          <form onSubmit={onSubmit} className="card" style={{ display: "grid", gap: 12, gridColumn: "span 2" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className={mode === "text-to-image" ? "button-primary" : "button-secondary"} onClick={() => setMode("text-to-image")}>Text to image</button>
              <button type="button" className={mode === "image-to-image" ? "button-primary" : "button-secondary"} onClick={() => setMode("image-to-image")}>Image to image</button>
            </div>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={7} placeholder="Опиши изображение, стиль, сцену и артефакт для проекта" className="card" style={{ padding: 14 }} />
            <div className="grid-3">
              <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)} className="card" style={{ padding: 14 }}>
                <option value="1:1">1:1</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="4:3">4:3</option>
              </select>
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="card" style={{ padding: 14 }}>
                <option value="">Без проекта</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </select>
              <select value={sourceFileId} onChange={(event) => setSourceFileId(event.target.value)} className="card" style={{ padding: 14 }} disabled={mode !== "image-to-image"}>
                <option value="">Источник</option>
                {images.map((file) => <option key={file.id} value={file.id}>{file.originalName}</option>)}
              </select>
            </div>
            {error ? <div style={{ color: "var(--error)" }}>{error}</div> : null}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="button-primary" type="submit">Сгенерировать</button>
              <a className="button-secondary" href="/files">Открыть files</a>
              {resultFile ? <a className="button-secondary" href={`/projects/${projectId}`}>Открыть project</a> : null}
            </div>
          </form>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Result</h2>
            {resultFile?.previewUrl ? <img src={resultFile.previewUrl} alt={resultFile.originalName} style={{ width: "100%", borderRadius: 18, border: "1px solid var(--border)" }} /> : <div className="muted">Результат появится после запуска job.</div>}
            {resultFile ? (
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                <div>{resultFile.originalName}</div>
                <a className="button-secondary" href="/documents">Открыть в documents</a>
              </div>
            ) : null}
          </div>
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <h2 style={{ marginTop: 0 }}>History</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {jobs.map((job) => (
              <div key={job.id} className="card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 700 }}>{job.id}</div>
                <div className="muted" style={{ marginTop: 6 }}>{job.status} · {new Date(job.createdAt).toLocaleString("ru-RU")}</div>
              </div>
            ))}
            {jobs.length === 0 ? <div className="muted">Пока нет image jobs.</div> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
