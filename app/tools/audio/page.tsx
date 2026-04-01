"use client";

import { FormEvent, useEffect, useState } from "react";

type Job = { id: string; status: string; createdAt: string; errorMessage?: string | null; output?: { attempts?: number } | null };
type UserFileItem = { id: string; originalName: string; kind: string };
type Project = { id: string; title: string };
type Capability = { transcription: string | null; tts: string | null };

function presentStatus(status: string) {
  if (status === "PENDING") return "В очереди";
  if (status === "RUNNING") return "В обработке";
  if (status === "SUCCEEDED") return "Готово";
  if (status === "FAILED") return "Ошибка";
  if (status === "CANCELLED") return "Остановлено";
  return status;
}

export default function AudioToolPage() {
  const [mode, setMode] = useState<"transcription" | "tts">("transcription");
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("alloy");
  const [projectId, setProjectId] = useState("");
  const [sourceFileId, setSourceFileId] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [files, setFiles] = useState<UserFileItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activeJobId, setActiveJobId] = useState("");
  const [capability, setCapability] = useState<Capability>({ transcription: null, tts: null });

  async function patchJob(jobId: string, action: "retry" | "cancel") {
    const response = await fetch(`/api/tools/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось обновить запрос");
      return;
    }
    setMessage(action === "retry" ? "Задание поставлено в очередь повторно." : "Задание отменено.");
    setActiveJobId(action === "retry" ? jobId : "");
    await loadJobs();
  }

  useEffect(() => {
    void Promise.all([loadJobs(), loadFiles(), loadProjects()]);
  }, []);

  async function loadJobs() {
    const response = await fetch("/api/tools/audio");
    const payload = await response.json();
    if (response.ok) {
      setJobs(payload.data.jobs || []);
      setCapability(payload.data.capability || { transcription: null, tts: null });
    }
  }

  async function loadFiles() {
    const response = await fetch("/api/files");
    const payload = await response.json();
    if (response.ok) {
      setFiles((payload.data.files || []).filter((entry: UserFileItem) => entry.kind === "AUDIO"));
    }
  }

  async function loadProjects() {
    const response = await fetch("/api/projects");
    const payload = await response.json();
    if (response.ok) {
      setProjects(payload.data.projects || []);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const response = await fetch("/api/tools/audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        text: mode === "tts" ? text : undefined,
        sourceFileId: mode === "transcription" ? sourceFileId || undefined : undefined,
        voice,
        projectId: projectId || undefined
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Задание завершилось с ошибкой");
      return;
    }

    setMessage("Задание поставлено в очередь.");
    setActiveJobId(payload.data.job.id);
    setText("");
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
      const job = payload.data.job as Job & { output?: { fileId?: string } };
      if (job.status === "SUCCEEDED") {
        setMessage("Аудиоартефакт готов.");
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

  return (
    <main className="workspace-page">
      <section className="panel workspace-panel">
        <div className="badge">Аудио</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Голос и аудио</h1>
        <p className="section-copy" style={{ maxWidth: 820 }}>
          Здесь можно расшифровать запись или подготовить озвучку текста, если этот режим доступен для выбранной модели.
        </p>
        <div className="grid-3" style={{ marginTop: 24 }}>
          <form onSubmit={onSubmit} className="card" style={{ display: "grid", gap: 12, gridColumn: "span 2" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className={mode === "transcription" ? "button-primary" : "button-secondary"} onClick={() => setMode("transcription")}>Расшифровка</button>
              {capability.tts ? <button type="button" className={mode === "tts" ? "button-primary" : "button-secondary"} onClick={() => setMode("tts")}>Озвучка</button> : null}
            </div>
            {mode === "transcription" ? (
              <select value={sourceFileId} onChange={(event) => setSourceFileId(event.target.value)} className="card" style={{ padding: 14 }}>
                <option value="">Выбери аудиофайл</option>
                {files.map((file) => <option key={file.id} value={file.id}>{file.originalName}</option>)}
              </select>
            ) : (
              <textarea value={text} onChange={(event) => setText(event.target.value)} rows={7} placeholder="Текст для озвучки" className="card" style={{ padding: 14 }} />
            )}
            <div className="grid-3">
              <input value={voice} onChange={(event) => setVoice(event.target.value)} placeholder="Голос" className="card" style={{ padding: 14 }} />
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="card" style={{ padding: 14 }}>
                <option value="">Без проекта</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </select>
              <a className="button-secondary" href="/files">Загрузить аудио</a>
            </div>
            {error ? <div style={{ color: "var(--error)" }}>{error}</div> : null}
            {message ? <div style={{ color: "var(--success)" }}>{message}</div> : null}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="button-primary" type="submit">Отправить запрос</button>
              <a className="button-secondary" href="/documents">Открыть документы</a>
            </div>
          </form>

          <div className="card">
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
        </div>
      </section>
    </main>
  );
}
