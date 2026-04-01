"use client";

import { FormEvent, useEffect, useState } from "react";

type Job = { id: string; status: string; createdAt: string };
type Project = { id: string; title: string };

export default function VideoToolPage() {
  const [mode, setMode] = useState<"storyboard" | "task">("storyboard");
  const [prompt, setPrompt] = useState("");
  const [durationSec, setDurationSec] = useState(15);
  const [projectId, setProjectId] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [message, setMessage] = useState("");
  const [activeJobId, setActiveJobId] = useState("");

  useEffect(() => {
    void Promise.all([loadJobs(), loadProjects()]);
  }, []);

  async function loadJobs() {
    const response = await fetch("/api/tools/video");
    const payload = await response.json();
    if (response.ok) {
      setJobs(payload.data.jobs || []);
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
    const response = await fetch("/api/tools/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        prompt,
        durationSec,
        projectId: projectId || undefined
      })
    });
    const payload = await response.json();
    if (response.ok) {
      setMessage(`Video ${mode} job поставлен в очередь: ${payload.data.job.id}`);
      setActiveJobId(payload.data.job.id);
      setPrompt("");
    } else {
      setMessage(payload.error?.message || "Не удалось создать video job");
    }
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
      if (job.status === "SUCCEEDED") {
        setMessage(`Video job ${activeJobId} завершён.`);
        setActiveJobId("");
        await loadJobs();
      } else if (job.status === "FAILED") {
        setMessage(`Video job ${activeJobId} завершился с ошибкой.`);
        setActiveJobId("");
        await loadJobs();
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [activeJobId]);

  return (
    <main className="workspace-page">
      <section className="panel workspace-panel">
        <div className="badge">Video</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Video Pipeline</h1>
        <p className="section-copy" style={{ maxWidth: 820 }}>
          Минимально рабочий video pipeline: storyboard prompt, video task create, список статусов и сохранение результата в project files.
        </p>

        <div className="grid-3" style={{ marginTop: 24 }}>
          <form onSubmit={onSubmit} className="card" style={{ display: "grid", gap: 12, gridColumn: "span 2" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className={mode === "storyboard" ? "button-primary" : "button-secondary"} onClick={() => setMode("storyboard")}>Storyboard prompt</button>
              <button type="button" className={mode === "task" ? "button-primary" : "button-secondary"} onClick={() => setMode("task")}>Video task create</button>
            </div>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={8} placeholder="Сценарий, визуальный ритм, камера, монтаж и expected output" className="card" style={{ padding: 14 }} />
            <div className="grid-3">
              <input type="number" min={5} max={180} value={durationSec} onChange={(event) => setDurationSec(Number(event.target.value))} className="card" style={{ padding: 14 }} />
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="card" style={{ padding: 14 }}>
                <option value="">Без проекта</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </select>
              <a className="button-secondary" href="/projects">Workspace</a>
            </div>
            {message ? <div className="muted">{message}</div> : null}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="button-primary" type="submit">Создать job</button>
              <a className="button-secondary" href="/files">Artifacts</a>
            </div>
          </form>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Statuses</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {jobs.map((job) => (
                <div key={job.id} className="card" style={{ padding: 16 }}>
                  <div style={{ fontWeight: 700 }}>{job.id}</div>
                  <div className="muted" style={{ marginTop: 6 }}>{job.status} · {new Date(job.createdAt).toLocaleString("ru-RU")}</div>
                </div>
              ))}
              {jobs.length === 0 ? <div className="muted">Video jobs пока нет.</div> : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
