"use client";

import { FormEvent, useEffect, useState } from "react";

type Job = { id: string; status: string; createdAt: string; errorMessage?: string | null };
type Project = { id: string; title: string };

function presentStatus(status: string) {
  if (status === "PENDING") return "В очереди";
  if (status === "RUNNING") return "Готовим материал";
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
  const [error, setError] = useState("");
  const [activeJobId, setActiveJobId] = useState("");

  useEffect(() => {
    void Promise.all([loadJobs(), loadProjects()]);
  }, []);

  useEffect(() => {
    if (!activeJobId) return;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/tools/jobs/${activeJobId}`);
      const payload = await response.json();
      if (!response.ok) return;
      const job = payload.data.job as Job;
      if (job.status === "SUCCEEDED") {
        setMessage("Материал готов и сохранён в файлы как сценарный артефакт, а не как видеофайл.");
        setActiveJobId("");
        await loadJobs();
      }
      if (job.status === "FAILED" || job.status === "CANCELLED") {
        setError(job.errorMessage || "Не удалось завершить подготовку");
        setActiveJobId("");
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [activeJobId]);

  async function loadJobs() {
    const response = await fetch("/api/tools/video");
    const payload = await response.json();
    if (response.ok) setJobs(payload.data.jobs || []);
  }

  async function loadProjects() {
    const response = await fetch("/api/projects");
    const payload = await response.json();
    if (response.ok) setProjects(payload.data.projects || []);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

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
    if (!response.ok) {
      setError(payload.message || "Не удалось подготовить материал");
      return;
    }
    setMessage("Запрос принят. Результатом будет сценарная основа или постановка задачи, а не готовое видео.");
    setActiveJobId(payload.data.job.id);
  }

  return (
    <div className="page-stack">
      <section className="surface">
        <div className="eyebrow">Видео</div>
        <h1 className="surface-title">Видео сейчас оформлено как video planning workspace, а не как фейковая генерация готового ролика.</h1>
        <p className="surface-copy">Здесь можно собрать сториборд, структуру сцен и понятную постановку задачи для съёмки, монтажа или следующего продакшн-этапа.</p>
      </section>

      <div className="media-grid">
        <section className="surface">
          <div className="toolbar-row">
            <button type="button" className={mode === "storyboard" ? "button-primary" : "button-secondary"} onClick={() => setMode("storyboard")}>
              Сториборд
            </button>
            <button type="button" className={mode === "task" ? "button-primary" : "button-secondary"} onClick={() => setMode("task")}>
              Постановка задачи
            </button>
          </div>

          <form onSubmit={onSubmit} className="section-stack" style={{ marginTop: 18 }}>
            <label className="field">
              <span>Что нужно подготовить</span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Опишите идею, аудиторию, визуальный стиль, кадры, темп, ключевые сцены и желаемый итог."
              />
            </label>

            <div className="content-grid two-columns">
              <label className="field">
                <span>Длительность, сек.</span>
                <input type="number" min={5} max={180} value={durationSec} onChange={(event) => setDurationSec(Number(event.target.value))} />
              </label>
              <label className="field">
                <span>Проект</span>
                <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                  <option value="">Без проекта</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? <div className="error-banner">{error}</div> : null}
            {message ? <div className="success-banner">{message}</div> : null}

            <div className="toolbar-row">
              <button className="button-primary" type="submit">
                Подготовить основу
              </button>
              <a href="/files" className="button-secondary">
                Открыть файлы
              </a>
            </div>
          </form>
        </section>

        <section className="surface">
          <div className="eyebrow">Результат</div>
          <h2 className="surface-title">Что именно вы получите</h2>
          <div className="feature-list">
            <div className="feature-row">
              <strong>Сториборд</strong>
              <span>Сцены, драматургия, темп, камера и монтаж по шагам.</span>
            </div>
            <div className="feature-row">
              <strong>Постановка задачи</strong>
              <span>Чёткое ТЗ для продакшена, команды или следующего этапа работы.</span>
            </div>
            <div className="feature-row">
              <strong>Без ложных обещаний</strong>
              <span>Раздел не выдаёт markdown за видеогенерацию и не маскирует planning под финальный рендер.</span>
            </div>
          </div>

          <div className="status-list" style={{ marginTop: 18 }}>
            {jobs.map((job) => (
              <div key={job.id} className="status-card">
                <strong>{new Date(job.createdAt).toLocaleString("ru-RU")}</strong>
                <span className="muted-text">{presentStatus(job.status)}</span>
                {job.errorMessage ? <span className="muted-text">{job.errorMessage}</span> : null}
              </div>
            ))}
            {jobs.length === 0 ? <div className="muted-text">Здесь появится история ваших материалов.</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
