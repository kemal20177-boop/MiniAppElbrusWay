"use client";

import { FormEvent, useEffect, useState } from "react";

type ProjectDetails = Record<string, unknown>;

const fieldStyle = {
  width: "100%",
  minHeight: 46,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-primary)",
  padding: "0 14px"
} as const;

export default function ProjectDetailsPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadProject();
  }, [params.id]);

  async function loadProject() {
    const response = await fetch(`/api/projects/${params.id}`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось загрузить проект");
      return;
    }

    const nextProject = payload.data.project;
    setProject(nextProject);
    setTitle(String(nextProject.title || ""));
    setSlug(String(nextProject.slug || ""));
    setDescription(String(nextProject.description || ""));
    setSystemPrompt(String(nextProject.systemPrompt || ""));
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const response = await fetch(`/api/projects/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        slug: slug || undefined,
        description,
        systemPrompt
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось сохранить проект");
      return;
    }

    setMessage("Проект обновлён");
    await loadProject();
  }

  const chats = Array.isArray(project?.chats) ? project?.chats : [];
  const files = Array.isArray(project?.files) ? project?.files : [];
  const documents = Array.isArray(project?.documents) ? project?.documents : [];
  const canvasDocs = Array.isArray(project?.canvasDocs) ? project?.canvasDocs : [];
  const instructions = Array.isArray(project?.instructions) ? project?.instructions : [];

  return (
    <main className="workspace-page">
      <section className="panel workspace-panel">
        <div className="badge">Project</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>{String(project?.title || "Проект")}</h1>
        {error ? <div style={{ color: "var(--error)", marginTop: 12 }}>{error}</div> : null}
        {message ? <div style={{ color: "var(--success)", marginTop: 12 }}>{message}</div> : null}

        <div className="grid-3" style={{ marginTop: 24 }}>
          <form className="card" onSubmit={saveProject}>
            <h2 style={{ marginTop: 0 }}>Настройки проекта</h2>
            <div style={{ display: "grid", gap: 10 }}>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Название" style={fieldStyle} />
              <input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="slug" style={fieldStyle} />
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="card" style={{ minHeight: 120, padding: 14 }} />
              <textarea value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} placeholder="Системная инструкция" className="card" style={{ minHeight: 140, padding: 14 }} />
              <button className="button-primary" type="submit">Сохранить</button>
            </div>
          </form>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Обзор</h2>
            <div className="muted">Чаты: {String((project?._count as Record<string, unknown> | undefined)?.chats || 0)}</div>
            <div className="muted">Файлы: {String((project?._count as Record<string, unknown> | undefined)?.files || 0)}</div>
            <div className="muted">Документы: {String((project?._count as Record<string, unknown> | undefined)?.documents || 0)}</div>
            <div className="muted">Канвас: {String((project?._count as Record<string, unknown> | undefined)?.canvasDocs || 0)}</div>
            <div className="muted">Поисковые сессии: {String((project?._count as Record<string, unknown> | undefined)?.searchSessions || 0)}</div>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Инструкции</h2>
            <div style={{ display: "grid", gap: 8 }}>
              {instructions.length === 0 ? <div className="muted">Пока нет инструкций проекта</div> : null}
              {instructions.map((entry) => (
                <div key={String((entry as Record<string, unknown>).id)} className="muted">
                  {String((entry as Record<string, unknown>).title || "...")}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid-3" style={{ marginTop: 24 }}>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Chats</h2>
            <div style={{ display: "grid", gap: 8 }}>
              {chats.length === 0 ? <div className="muted">Чатов пока нет</div> : null}
              {chats.map((entry) => (
                <div key={String((entry as Record<string, unknown>).id)} className="muted">
                  {String((entry as Record<string, unknown>).title || "...")}
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Files</h2>
            <div style={{ display: "grid", gap: 8 }}>
              {files.length === 0 ? <div className="muted">Файлов пока нет</div> : null}
              {files.map((entry) => (
                <div key={String((entry as Record<string, unknown>).id)} className="muted">
                  {String(((entry as Record<string, unknown>).file as Record<string, unknown> | null)?.originalName || "...")}
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Documents & Canvas</h2>
            <div style={{ display: "grid", gap: 8 }}>
              {documents.map((entry) => (
                <div key={String((entry as Record<string, unknown>).id)} className="muted">
                  Doc: {String(((entry as Record<string, unknown>).document as Record<string, unknown> | null)?.title || "...")}
                </div>
              ))}
              {canvasDocs.map((entry) => (
                <div key={String((entry as Record<string, unknown>).id)} className="muted">
                  Canvas: {String((entry as Record<string, unknown>).title || "...")}
                </div>
              ))}
              {documents.length === 0 && canvasDocs.length === 0 ? <div className="muted">Пока пусто</div> : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
