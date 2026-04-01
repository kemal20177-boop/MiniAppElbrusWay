"use client";

import { FormEvent, useEffect, useState } from "react";

type ProjectCard = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  color: string | null;
  isArchived: boolean;
  updatedAt: string;
  _count: {
    chats: number;
    files: number;
    documents: number;
    canvasDocs: number;
    instructions: number;
  };
};

const fieldStyle = {
  width: "100%",
  minHeight: 46,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-primary)",
  padding: "0 14px"
} as const;

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadProjects();
  }, []);

  async function loadProjects() {
    const response = await fetch("/api/projects");
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось загрузить проекты");
      return;
    }

    setProjects(payload.data.projects || []);
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        slug: slug || undefined,
        description: description || undefined,
        systemPrompt: systemPrompt || undefined
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось создать проект");
      return;
    }

    setMessage("Проект создан");
    setTitle("");
    setSlug("");
    setDescription("");
    setSystemPrompt("");
    await loadProjects();
  }

  async function archiveProject(projectId: string, isArchived: boolean) {
    const response = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: !isArchived })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось обновить проект");
      return;
    }

    setMessage(!isArchived ? "Проект архивирован" : "Проект восстановлен");
    await loadProjects();
  }

  async function removeProject(projectId: string) {
    const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось удалить проект");
      return;
    }

    setMessage("Проект удалён");
    await loadProjects();
  }

  return (
    <main className="workspace-page">
      <section className="panel workspace-panel">
        <div className="badge">Projects</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Проекты</h1>
        <p className="section-copy" style={{ maxWidth: 760 }}>
          Проект уже работает как контейнер верхнего уровня. Следующие этапы подключат сюда project files,
          linked chats, documents, canvas и local project context.
        </p>
        {error ? <div style={{ color: "var(--error)", marginTop: 12 }}>{error}</div> : null}
        {message ? <div style={{ color: "var(--success)", marginTop: 12 }}>{message}</div> : null}

        <div className="grid-3" style={{ marginTop: 24 }}>
          <form className="card" onSubmit={createProject}>
            <h2 style={{ marginTop: 0 }}>Новый проект</h2>
            <div style={{ display: "grid", gap: 10 }}>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Название проекта" style={fieldStyle} />
              <input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="slug (опционально)" style={fieldStyle} />
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Описание" className="card" style={{ minHeight: 120, padding: 14 }} />
              <textarea value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} placeholder="Системная инструкция проекта" className="card" style={{ minHeight: 120, padding: 14 }} />
              <button className="button-primary" type="submit">Создать проект</button>
            </div>
          </form>

          <div className="card" style={{ gridColumn: "span 2" }}>
            <h2 style={{ marginTop: 0 }}>Активные проекты</h2>
            <div style={{ display: "grid", gap: 14 }}>
              {projects.length === 0 ? <div className="muted">Проектов пока нет</div> : null}
              {projects.map((project) => (
                <div key={project.id} className="card" style={{ padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{project.title}</div>
                      <div className="muted" style={{ marginTop: 4 }}>
                        slug: {project.slug || "—"} · обновлён {new Date(project.updatedAt).toLocaleString("ru-RU")}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <a className="button-secondary" href={`/projects/${project.id}`}>Открыть</a>
                      <button className="button-ghost" type="button" onClick={() => void archiveProject(project.id, project.isArchived)}>
                        {project.isArchived ? "Восстановить" : "Архивировать"}
                      </button>
                      <button className="button-ghost" type="button" onClick={() => void removeProject(project.id)}>
                        Удалить
                      </button>
                    </div>
                  </div>
                  <div className="muted" style={{ marginTop: 10 }}>{project.description || "Без описания"}</div>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 14 }} className="muted">
                    <span>Чаты: {project._count.chats}</span>
                    <span>Файлы: {project._count.files}</span>
                    <span>Документы: {project._count.documents}</span>
                    <span>Canvas: {project._count.canvasDocs}</span>
                    <span>Инструкции: {project._count.instructions}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
