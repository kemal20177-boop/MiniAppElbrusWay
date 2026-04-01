"use client";

import { FormEvent, useEffect, useState } from "react";

type Job = { id: string; status: string; createdAt: string };
type UserFileItem = { id: string; originalName: string; kind: string };
type Project = { id: string; title: string };

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

  useEffect(() => {
    void Promise.all([loadJobs(), loadFiles(), loadProjects()]);
  }, []);

  async function loadJobs() {
    const response = await fetch("/api/tools/audio");
    const payload = await response.json();
    if (response.ok) {
      setJobs(payload.data.jobs || []);
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
      setError(payload.error?.message || "Audio job завершился с ошибкой");
      return;
    }

    setMessage("Audio job поставлен в очередь.");
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
        setMessage("Audio artifact готов.");
        setActiveJobId("");
        await loadJobs();
      } else if (job.status === "FAILED") {
        setError("Audio job завершился с ошибкой");
        setActiveJobId("");
        await loadJobs();
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [activeJobId]);

  return (
    <main className="workspace-page">
      <section className="panel workspace-panel">
        <div className="badge">Audio</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Audio Pipeline</h1>
        <p className="section-copy" style={{ maxWidth: 820 }}>
          Страница даёт два режима: transcription по загруженному аудио и TTS job с сохранением результата в files/project artifacts.
        </p>
        <div className="grid-3" style={{ marginTop: 24 }}>
          <form onSubmit={onSubmit} className="card" style={{ display: "grid", gap: 12, gridColumn: "span 2" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className={mode === "transcription" ? "button-primary" : "button-secondary"} onClick={() => setMode("transcription")}>Transcription</button>
              <button type="button" className={mode === "tts" ? "button-primary" : "button-secondary"} onClick={() => setMode("tts")}>TTS</button>
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
              <input value={voice} onChange={(event) => setVoice(event.target.value)} placeholder="Voice" className="card" style={{ padding: 14 }} />
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="card" style={{ padding: 14 }}>
                <option value="">Без проекта</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </select>
              <a className="button-secondary" href="/files">Upload audio</a>
            </div>
            {error ? <div style={{ color: "var(--error)" }}>{error}</div> : null}
            {message ? <div style={{ color: "var(--success)" }}>{message}</div> : null}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="button-primary" type="submit">Запустить job</button>
              <a className="button-secondary" href="/documents">Открыть documents</a>
            </div>
          </form>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>History</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {jobs.map((job) => (
                <div key={job.id} className="card" style={{ padding: 16 }}>
                  <div style={{ fontWeight: 700 }}>{job.id}</div>
                  <div className="muted" style={{ marginTop: 6 }}>{job.status} · {new Date(job.createdAt).toLocaleString("ru-RU")}</div>
                </div>
              ))}
              {jobs.length === 0 ? <div className="muted">Audio jobs пока не запускались.</div> : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
