"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ModelPicker } from "@/components/app/model-picker";
import { buildUiModels, type UiModel } from "@/lib/model-ui";

type Project = { id: string; title: string };
type Job = { id: string; status: string; createdAt: string; errorMessage?: string | null; output?: { fileId?: string; previewUrl?: string } | null };
type FileRecord = { id: string; originalName: string; previewUrl: string | null };

function statusText(status: string) {
  if (status === "PENDING") return "В очереди";
  if (status === "RUNNING") return "Готовим результат";
  if (status === "SUCCEEDED") return "Готово";
  if (status === "FAILED") return "Ошибка";
  if (status === "CANCELLED") return "Остановлено";
  return status;
}

export default function ImageToolPage() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"text-to-image" | "image-to-image">(
    searchParams.get("mode") === "image-to-image" ? "image-to-image" : "text-to-image"
  );
  const [models, setModels] = useState<UiModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [projectId, setProjectId] = useState("");
  const [sourceFileId, setSourceFileId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [images, setImages] = useState<FileRecord[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobId, setActiveJobId] = useState("");
  const [resultFile, setResultFile] = useState<FileRecord | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      const [modelsResponse, projectsResponse, filesResponse, jobsResponse] = await Promise.all([
        fetch("/api/models"),
        fetch("/api/projects"),
        fetch("/api/files?kind=IMAGE"),
        fetch("/api/tools/image")
      ]);
      const [modelsPayload, projectsPayload, filesPayload, jobsPayload] = await Promise.all([
        modelsResponse.json(),
        projectsResponse.json(),
        filesResponse.json(),
        jobsResponse.json()
      ]);

      if (modelsResponse.ok) {
        const nextModels = buildUiModels(modelsPayload.data || []).filter((model) => model.supportsImages);
        setModels(nextModels);
        if (nextModels[0]?.id) {
          setSelectedModel((current) =>
            current ||
            nextModels.find((model) => model.family === "nano-banana-2")?.id ||
            nextModels.find((model) => model.family === "nano-banana-pro")?.id ||
            nextModels[0].id
          );
        }
      }
      if (projectsResponse.ok) setProjects(projectsPayload.data.projects || []);
      if (filesResponse.ok) setImages(filesPayload.data.files || []);
      if (jobsResponse.ok) setJobs(jobsPayload.data.jobs || []);
    })();
  }, []);

  useEffect(() => {
    if (!activeJobId) return;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/tools/jobs/${activeJobId}`);
      const payload = await response.json();
      if (!response.ok) return;
      const job = payload.data.job as Job;
      if (job.status === "SUCCEEDED" && job.output?.fileId) {
        const fileResponse = await fetch(`/api/files/${job.output.fileId}`);
        const filePayload = await fileResponse.json();
        if (fileResponse.ok) {
          setResultFile(filePayload.data.file);
        }
        setActiveJobId("");
        setMessage("Изображение готово и сохранено в файлы.");
        await Promise.all([loadJobs(), loadFiles()]);
      }
      if (job.status === "FAILED" || job.status === "CANCELLED") {
        setError(job.errorMessage || "Не удалось подготовить изображение");
        setActiveJobId("");
        await loadJobs();
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [activeJobId]);

  async function loadProjects() {
    const response = await fetch("/api/projects");
    const payload = await response.json();
    if (response.ok) setProjects(payload.data.projects || []);
  }

  async function loadFiles() {
    const response = await fetch("/api/files?kind=IMAGE");
    const payload = await response.json();
    if (response.ok) setImages(payload.data.files || []);
  }

  async function loadJobs() {
    const response = await fetch("/api/tools/image");
    const payload = await response.json();
    if (response.ok) setJobs(payload.data.jobs || []);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setResultFile(null);

    const response = await fetch("/api/tools/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        prompt,
        aspectRatio,
        projectId: projectId || undefined,
        sourceFileId: mode === "image-to-image" ? sourceFileId || undefined : undefined,
        model: selectedModel || undefined
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.message || "Не удалось запустить генерацию");
      return;
    }
    setActiveJobId(payload.data.job.id);
    setMessage("Запрос принят. Обычно результат появляется через несколько секунд.");
  }

  const selectedModelMeta = useMemo(() => models.find((model) => model.id === selectedModel) || null, [models, selectedModel]);

  return (
    <div className="page-stack">
      <section className="surface">
        <div className="eyebrow">Изображения</div>
        <h1 className="surface-title">Создавайте новые изображения и аккуратно редактируйте готовые.</h1>
        <p className="surface-copy">Выберите модель, опишите сцену, а результат сразу сохранится в ваши файлы и проекты.</p>
      </section>

      <div className="media-grid">
        <section className="surface">
          <div className="toolbar-row">
            <button type="button" className={mode === "text-to-image" ? "button-primary" : "button-secondary"} onClick={() => setMode("text-to-image")}>
              Создать изображение
            </button>
            <button type="button" className={mode === "image-to-image" ? "button-primary" : "button-secondary"} onClick={() => setMode("image-to-image")}>
              Редактировать изображение
            </button>
          </div>

          <ModelPicker
            models={models}
            value={selectedModel}
            onChange={setSelectedModel}
            title="Выберите модель для изображения"
            description="Nano Banana 2 и Nano Banana Pro выделены как быстрый вход для визуальных сценариев."
          />

          <form onSubmit={onSubmit} className="section-stack" style={{ marginTop: 18 }}>
            <label className="field">
              <span>Что нужно получить</span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Опишите сюжет, стиль, настроение, детали и формат результата."
              />
            </label>

            <div className="content-grid two-columns">
              <label className="field">
                <span>Формат кадра</span>
                <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)}>
                  {["1:1", "3:4", "4:3", "16:9", "9:16"].map((ratio) => (
                    <option key={ratio} value={ratio}>
                      {ratio}
                    </option>
                  ))}
                </select>
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

            {mode === "image-to-image" ? (
              <label className="field">
                <span>Исходное изображение</span>
                <select value={sourceFileId} onChange={(event) => setSourceFileId(event.target.value)}>
                  <option value="">Выберите файл</option>
                  {images.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.originalName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {selectedModelMeta ? <div className="success-banner">Сейчас выбрана модель: {selectedModelMeta.name}</div> : null}
            {error ? <div className="error-banner">{error}</div> : null}
            {message ? <div className="success-banner">{message}</div> : null}

            <div className="toolbar-row">
              <button className="button-primary" type="submit">
                Запустить
              </button>
              <a href="/files" className="button-secondary">
                Открыть файлы
              </a>
            </div>
          </form>
        </section>

        <section className="surface">
          <div className="eyebrow">Результат</div>
          <h2 className="surface-title">Предпросмотр</h2>
          <div className="preview-frame" style={{ minHeight: 320, display: "grid", placeItems: "center" }}>
            {resultFile?.previewUrl ? (
              <img src={resultFile.previewUrl} alt={resultFile.originalName} />
            ) : (
              <div className="muted-text" style={{ padding: 24, textAlign: "center" }}>
                После завершения генерации результат появится здесь.
              </div>
            )}
          </div>
          {resultFile ? <div className="muted-text" style={{ marginTop: 12 }}>{resultFile.originalName}</div> : null}

          <div className="status-list" style={{ marginTop: 18 }}>
            {jobs.slice(0, 6).map((job) => (
              <div key={job.id} className="status-card">
                <strong>{new Date(job.createdAt).toLocaleString("ru-RU")}</strong>
                <span className="muted-text">{statusText(job.status)}</span>
                {job.errorMessage ? <span className="muted-text">{job.errorMessage}</span> : null}
              </div>
            ))}
            {jobs.length === 0 ? <div className="muted-text">Здесь появится история ваших изображений.</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
