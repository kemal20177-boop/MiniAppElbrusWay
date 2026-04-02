"use client";

import { FormEvent, useEffect, useState } from "react";
import { ModelPicker } from "@/components/app/model-picker";
import { buildUiModels, type UiModel } from "@/lib/model-ui";

type Job = { id: string; status: string; createdAt: string; errorMessage?: string | null };
type UserFileItem = { id: string; originalName: string; kind: string };
type Project = { id: string; title: string };

function presentStatus(status: string) {
  if (status === "PENDING") return "В очереди";
  if (status === "RUNNING") return "Обрабатываем";
  if (status === "SUCCEEDED") return "Готово";
  if (status === "FAILED") return "Ошибка";
  if (status === "CANCELLED") return "Остановлено";
  return status;
}

export default function AudioToolPage() {
  const [models, setModels] = useState<UiModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
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
  const [voiceReady, setVoiceReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const [modelsResponse, jobsResponse, filesResponse, projectsResponse] = await Promise.all([
        fetch("/api/models"),
        fetch("/api/tools/audio"),
        fetch("/api/files"),
        fetch("/api/projects")
      ]);
      const [modelsPayload, jobsPayload, filesPayload, projectsPayload] = await Promise.all([
        modelsResponse.json(),
        jobsResponse.json(),
        filesResponse.json(),
        projectsResponse.json()
      ]);

      if (modelsResponse.ok) {
        const nextModels = buildUiModels(modelsPayload.data || []).filter((model) => model.supportsAudio);
        setModels(nextModels);
        if (nextModels[0]?.id) {
          setSelectedModel((current) => current || nextModels[0].id);
        }
      }
      if (jobsResponse.ok) {
        setJobs(jobsPayload.data.jobs || []);
        setVoiceReady(Boolean(jobsPayload.data.setup?.voiceReady));
      }
      if (filesResponse.ok) {
        setFiles((filesPayload.data.files || []).filter((entry: UserFileItem) => entry.kind === "AUDIO"));
      }
      if (projectsResponse.ok) {
        setProjects(projectsPayload.data.projects || []);
      }
    })();
  }, []);

  useEffect(() => {
    if (!activeJobId) return;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/tools/jobs/${activeJobId}`);
      const payload = await response.json();
      if (!response.ok) return;
      const job = payload.data.job as Job;
      if (job.status === "SUCCEEDED") {
        setMessage(mode === "tts" ? "Озвучка готова и сохранена в файлы." : "Расшифровка готова и сохранена в файлы.");
        setActiveJobId("");
        await loadJobs();
      }
      if (job.status === "FAILED" || job.status === "CANCELLED") {
        setError(job.errorMessage || "Задача завершилась с ошибкой");
        setActiveJobId("");
        await loadJobs();
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [activeJobId, mode]);

  async function loadJobs() {
    const response = await fetch("/api/tools/audio");
    const payload = await response.json();
    if (response.ok) {
      setJobs(payload.data.jobs || []);
      setVoiceReady(Boolean(payload.data.setup?.voiceReady));
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
    if (response.ok) setProjects(payload.data.projects || []);
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
        model: selectedModel || undefined,
        text: mode === "tts" ? text : undefined,
        sourceFileId: mode === "transcription" ? sourceFileId || undefined : undefined,
        voice,
        projectId: projectId || undefined
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.message || "Не удалось запустить задачу");
      return;
    }

    setMessage("Запрос принят. Результат появится в файлах.");
    setActiveJobId(payload.data.job.id);
  }

  return (
    <div className="page-stack">
      <section className="surface">
        <div className="eyebrow">Аудио</div>
        <h1 className="surface-title">Расшифровывайте записи и готовьте озвучку текста в одном месте.</h1>
        <p className="surface-copy">Раздел сделан без технических терминов: выберите сценарий, добавьте файл или текст и дождитесь результата.</p>
      </section>

      <div className="media-grid">
        <section className="surface">
          <div className="toolbar-row">
            <button type="button" className={mode === "transcription" ? "button-primary" : "button-secondary"} onClick={() => setMode("transcription")}>
              Расшифровать аудио
            </button>
            <button
              type="button"
              className={mode === "tts" ? "button-primary" : "button-secondary"}
              onClick={() => setMode("tts")}
              disabled={!voiceReady}
            >
              Озвучить текст
            </button>
          </div>

          {models.length > 0 ? (
            <ModelPicker
              models={models}
              value={selectedModel}
              onChange={setSelectedModel}
              title="Выберите модель для аудио"
              description="Отдельный выбор для расшифровки и озвучки без технических названий внутри интерфейса."
            />
          ) : null}

          <form onSubmit={onSubmit} className="section-stack" style={{ marginTop: 18 }}>
            {mode === "transcription" ? (
              <label className="field">
                <span>Аудиофайл</span>
                <select value={sourceFileId} onChange={(event) => setSourceFileId(event.target.value)}>
                  <option value="">Выберите файл</option>
                  {files.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.originalName}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="field">
                <span>Текст для озвучки</span>
                <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Введите текст, который нужно озвучить." />
              </label>
            )}

            <div className="content-grid two-columns">
              <label className="field">
                <span>Голос</span>
                <input value={voice} onChange={(event) => setVoice(event.target.value)} placeholder="Например: alloy" />
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

            {!voiceReady ? <div className="muted-text">Озвучка откроется автоматически, когда будет доступна в вашем аккаунте.</div> : null}
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
          <div className="eyebrow">История</div>
          <h2 className="surface-title">Последние действия</h2>
          <div className="status-list">
            {jobs.map((job) => (
              <div key={job.id} className="status-card">
                <strong>{new Date(job.createdAt).toLocaleString("ru-RU")}</strong>
                <span className="muted-text">{presentStatus(job.status)}</span>
                {job.errorMessage ? <span className="muted-text">{job.errorMessage}</span> : null}
              </div>
            ))}
            {jobs.length === 0 ? <div className="muted-text">Здесь появятся расшифровки и озвучки.</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
