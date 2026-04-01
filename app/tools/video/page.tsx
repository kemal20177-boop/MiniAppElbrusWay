"use client";

import { FormEvent, useEffect, useState } from "react";

type Job = { id: string; status: string; createdAt: string; errorMessage?: string | null; output?: { attempts?: number } | null };
type Project = { id: string; title: string };
type Capability = { videoAnalysis: string | null; generation: boolean; beta: boolean };

function presentStatus(status: string) {
  if (status === "PENDING") return "В очереди";
  if (status === "RUNNING") return "В обработке";
  if (status === "SUCCEEDED") return "Готово";
  if (status === "FAILED") return "Ошибка";
  if (status === "CANCELLED") return "Остановлено";
  return status;
}

export default function VideoToolPage() {
  const [mode, setMode] = useState<"storyboard" | "task">("storyboard");
  const [prompt, setPrompt] = useState("");
  const [durationSec, setDurationSec] = useState(15);
  const [projectId, setProjectId] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [message, setMessage] = useState("");
  const [activeJobId, setActiveJobId] = useState("");
  const [capability, setCapability] = useState<Capability>({ videoAnalysis: null, generation: false, beta: true });

  async function patchJob(jobId: string, action: "retry" | "cancel") {
    const response = await fetch(`/api/tools/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error?.message || "Не удалось обновить задание");
      return;
    }
    setMessage(action === "retry" ? `Задание ${jobId} поставлено в очередь повторно.` : `Задание ${jobId} отменено.`);
    setActiveJobId(action === "retry" ? jobId : "");
    await loadJobs();
  }

  useEffect(() => {
    void Promise.all([loadJobs(), loadProjects()]);
  }, []);

  async function loadJobs() {
    const response = await fetch("/api/tools/video");
    const payload = await response.json();
    if (response.ok) {
      setJobs(payload.data.jobs || []);
      setCapability(payload.data.capability || { videoAnalysis: null, generation: false, beta: true });
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
      setMessage(`Задание поставлено в очередь: ${payload.data.job.id}`);
      setActiveJobId(payload.data.job.id);
      setPrompt("");
    } else {
      setMessage(payload.error?.message || "Не удалось создать задание");
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
        setMessage(`Задание ${activeJobId} завершено.`);
        setActiveJobId("");
        await loadJobs();
      } else if (job.status === "FAILED" || job.status === "CANCELLED") {
        setMessage(job.errorMessage || `Задание ${activeJobId} завершилось с ошибкой.`);
        setActiveJobId("");
        await loadJobs();
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [activeJobId]);

  return (
    <main className="workspace-page">
      <section className="panel workspace-panel">
        <div className="badge">Видео</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Видео</h1>
        <p className="section-copy" style={{ maxWidth: 820 }}>
          Подготовь идею ролика, собери структуру сцены и оформи задачу для дальнейшей работы с видео.
        </p>

        <div className="grid-3" style={{ marginTop: 24 }}>
          <form onSubmit={onSubmit} className="card" style={{ display: "grid", gap: 12, gridColumn: "span 2" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className={mode === "storyboard" ? "button-primary" : "button-secondary"} onClick={() => setMode("storyboard")}>Сториборд</button>
              <button type="button" className={mode === "task" ? "button-primary" : "button-secondary"} onClick={() => setMode("task")}>Постановка задачи</button>
            </div>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={8} placeholder="Сценарий, визуальный ритм, камера, монтаж и ожидаемый результат" className="card" style={{ padding: 14 }} />
            <div className="grid-3">
              <input type="number" min={5} max={180} value={durationSec} onChange={(event) => setDurationSec(Number(event.target.value))} className="card" style={{ padding: 14 }} />
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="card" style={{ padding: 14 }}>
                <option value="">Без проекта</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </select>
              <a className="button-secondary" href="/projects">Открыть проекты</a>
            </div>
            {message ? <div className="muted">{message}</div> : null}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="button-primary" type="submit">Создать материал</button>
              <a className="button-secondary" href="/files">Файлы</a>
            </div>
          </form>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Статусы</h2>
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
