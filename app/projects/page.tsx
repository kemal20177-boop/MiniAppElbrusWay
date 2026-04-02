"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type ProjectCard = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
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

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/projects");
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message || "Не удалось загрузить проекты");
        return;
      }
      setProjects(payload.data.projects || []);
    })();
  }, []);

  async function reloadProjects() {
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
    await reloadProjects();
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
    setMessage(!isArchived ? "Проект отправлен в архив" : "Проект снова активен");
    await reloadProjects();
  }

  async function removeProject(projectId: string) {
    const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось удалить проект");
      return;
    }
    setMessage("Проект удалён");
    await reloadProjects();
  }

  return (
    <div className="page-stack">
      <section className="surface">
        <div className="eyebrow">Проекты</div>
        <h1 className="surface-title">Собирайте чаты, файлы, документы и заметки по одной задаче в одном месте.</h1>
        <p className="surface-copy">Проект помогает не потерять контекст: вы можете держать материалы, инструкции и рабочие артефакты вместе.</p>
      </section>

      <div className="content-grid two-columns">
        <section className="surface">
          <div className="eyebrow">Новый проект</div>
          <h2 className="surface-title">Создайте контейнер для работы</h2>
          <form onSubmit={createProject} className="section-stack">
            <label className="field">
              <span>Название</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например: Рекламная кампания апреля" />
            </label>
            <label className="field">
              <span>Короткий адрес</span>
              <input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="Необязательно" />
            </label>
            <label className="field">
              <span>Описание</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Коротко опишите задачу и что здесь будет храниться." />
            </label>
            <label className="field">
              <span>Контекст для модели</span>
              <textarea value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} placeholder="Подсказка для себя: важные правила, тон или требования проекта." />
            </label>
            {error ? <div className="error-banner">{error}</div> : null}
            {message ? <div className="success-banner">{message}</div> : null}
            <button className="button-primary" type="submit">
              Создать проект
            </button>
          </form>
        </section>

        <section className="surface">
          <div className="eyebrow">Список</div>
          <h2 className="surface-title">Ваши проекты</h2>
          <div className="status-list">
            {projects.map((project) => (
              <article key={project.id} className="status-card">
                <div className="feature-row">
                  <strong>{project.title}</strong>
                  <span>{project.description || "Описание пока не добавлено."}</span>
                </div>
                <div className="toolbar-row">
                  <span className="mini-badge">Чаты: {project._count.chats}</span>
                  <span className="mini-badge">Файлы: {project._count.files}</span>
                  <span className="mini-badge">Документы: {project._count.documents}</span>
                </div>
                <div className="muted-text">Обновлён: {new Date(project.updatedAt).toLocaleString("ru-RU")}</div>
                <div className="toolbar-row">
                  <Link href={`/projects/${project.id}`} className="button-secondary">
                    Открыть
                  </Link>
                  <button className="button-ghost" type="button" onClick={() => void archiveProject(project.id, project.isArchived)}>
                    {project.isArchived ? "Вернуть" : "В архив"}
                  </button>
                  <button className="button-ghost" type="button" onClick={() => void removeProject(project.id)}>
                    Удалить
                  </button>
                </div>
              </article>
            ))}
            {projects.length === 0 ? <div className="muted-text">Пока нет ни одного проекта.</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
