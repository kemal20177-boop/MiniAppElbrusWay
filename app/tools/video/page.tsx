"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ModelPicker } from "@/components/app/model-picker";
import { type UiModel } from "@/lib/model-ui";
import { videoModels } from "@/lib/site";

type Job = {
  id: string;
  status: string;
  createdAt: string;
  errorMessage?: string | null;
  output?: { fileId?: string; previewUrl?: string } | null;
};
type Project = { id: string; title: string };
type FileRecord = { id: string; originalName: string; previewUrl: string | null; mimeType: string };

function presentStatus(status: string) {
  if (status === "PENDING") return "В очереди";
  if (status === "RUNNING") return "Генерируем";
  if (status === "SUCCEEDED") return "Готово";
  if (status === "FAILED") return "Ошибка";
  if (status === "CANCELLED") return "Остановлено";
  return status;
}

export default function VideoToolPage() {
  const [mode, setMode] = useState<"generate" | "storyboard">("generate");
  const [prompt, setPrompt] = useState("");
  const [durationSec, setDurationSec] = useState(15);
  const [projectId, setProjectId] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activeJobId, setActiveJobId] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(videoModels[2]?.id || videoModels[0].id);
  const [resultFile, setResultFile] = useState<FileRecord | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const pickerModels: UiModel[] = useMemo(
    () =>
      videoModels.map((model) => ({
        id: model.id,
        name: model.name,
        provider: model.provider,
        family: "auto",
        summary: model.description,
        badge: model.minPlan,
        supportsChat: false,
        supportsImages: false,
        supportsVideo: true,
        supportsAudio: false,
        supportsVision: false,
        featured: model.id === "google/veo-3"
      })),
    []
  );

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
        setMessage("Сториборд готов и сохранён в файлы.");
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
    setLoading(true);

    try {
      const response = await fetch("/api/tools/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          model: mode === "generate" ? selectedModel : undefined,
          prompt,
          durationSec,
          projectId: projectId || undefined
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.message || "Не удалось подготовить видео");
        return;
      }

      if (mode === "generate") {
        setResultFile(payload.data.file || null);
        setVideoUrl(payload.data.videoUrl || payload.data.file?.previewUrl || "");
        setMessage("Видео сгенерировано через RouterAI и сохранено в файлы.");
        return;
      }

      setMessage("Запрос принят. Сториборд появится в файлах после обработки.");
      setActiveJobId(payload.data.job.id);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="surface">
        <div className="eyebrow">Видео</div>
        <h1 className="surface-title">Генерация видео и сторибордов в одном разделе</h1>
        <p className="surface-copy">Создайте готовый ролик через RouterAI или соберите сториборд для продакшена, если нужен подготовительный этап.</p>
      </section>

      <div className="media-grid">
        <section className="surface">
          <div className="toolbar-row">
            <button type="button" className={mode === "generate" ? "button-primary" : "button-secondary"} onClick={() => setMode("generate")}>
              Генерация видео
            </button>
            <button type="button" className={mode === "storyboard" ? "button-primary" : "button-secondary"} onClick={() => setMode("storyboard")}>
              Сториборд
            </button>
          </div>

          {mode === "generate" ? (
            <ModelPicker
              models={pickerModels}
              value={selectedModel}
              onChange={setSelectedModel}
              title="Выберите модель для видео"
              description="Доступны Google Veo 3, Kling 2.6 и MiniMax Video."
              mode="video"
            />
          ) : null}

          <form onSubmit={onSubmit} className="section-stack" style={{ marginTop: 18 }}>
            <label className="field">
              <span>{mode === "generate" ? "Что нужно сгенерировать" : "Что нужно подготовить"}</span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Опишите сюжет, стиль, сцену, движение камеры, персонажей и желаемый итог."
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
              <button className="button-primary" type="submit" disabled={loading}>
                {loading ? "Обрабатываем..." : mode === "generate" ? "Сгенерировать" : "Подготовить"}
              </button>
              <a href="/files" className="button-secondary">
                Открыть файлы
              </a>
            </div>
          </form>
        </section>

        <section className="surface">
          <div className="eyebrow">Результат</div>
          <h2 className="surface-title">{mode === "generate" ? "Предпросмотр видео" : "История сторибордов"}</h2>

          {mode === "generate" ? (
            <>
              <div className="preview-frame" style={{ minHeight: 320 }}>
                {resultFile?.previewUrl && resultFile.mimeType.startsWith("video/") ? (
                  <video controls style={{ width: "100%", borderRadius: 8 }}>
                    <source src={resultFile.previewUrl} type={resultFile.mimeType} />
                  </video>
                ) : (
                  <div className="muted-text" style={{ padding: 24, textAlign: "center" }}>
                    После генерации здесь появится ссылка или готовый видеофайл.
                  </div>
                )}
              </div>
              {videoUrl ? (
                <div className="feature-list" style={{ marginTop: 16 }}>
                  <div className="feature-row">
                    <strong>URL результата</strong>
                    <span style={{ wordBreak: "break-all" }}>{videoUrl}</span>
                  </div>
                  {resultFile ? (
                    <div className="feature-row">
                      <strong>Файл сохранён</strong>
                      <span>{resultFile.originalName}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="status-list">
              {jobs.map((job) => (
                <div key={job.id} className="status-card">
                  <strong>{new Date(job.createdAt).toLocaleString("ru-RU")}</strong>
                  <span className="muted-text">{presentStatus(job.status)}</span>
                  {job.errorMessage ? <span className="muted-text">{job.errorMessage}</span> : null}
                </div>
              ))}
              {jobs.length === 0 ? <div className="muted-text">Здесь появится история ваших материалов.</div> : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
