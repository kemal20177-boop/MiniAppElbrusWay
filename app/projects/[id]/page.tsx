"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type ProjectDetails = Record<string, unknown>;

export default function ProjectDetailsPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
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
    })();
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
    setMessage("Изменения сохранены");
    await loadProject();
  }

  const stats = (project?._count as Record<string, unknown> | undefined) || {};
  const chats = Array.isArray(project?.chats) ? project.chats : [];
  const files = Array.isArray(project?.files) ? project.files : [];
  const documents = Array.isArray(project?.documents) ? project.documents : [];
  const canvasDocs = Array.isArray(project?.canvasDocs) ? project.canvasDocs : [];
  const instructions = Array.isArray(project?.instructions) ? project.instructions : [];

  return (
    <div className="page-stack">
      <section className="surface">
        <div className="eyebrow">Проект</div>
        <h1 className="surface-title">{String(project?.title || "Проект")}</h1>
        <p className="surface-copy">Здесь собран обзор проекта и всё, что помогает держать контекст рядом с рабочими материалами.</p>
      </section>

      <div className="content-grid two-columns">
        <section className="surface">
          <div className="eyebrow">Настройки</div>
          <h2 className="surface-title">Основная информация</h2>
          <form onSubmit={saveProject} className="section-stack">
            <label className="field">
              <span>Название</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="field">
              <span>Короткий адрес</span>
              <input value={slug} onChange={(event) => setSlug(event.target.value)} />
            </label>
            <label className="field">
              <span>Описание</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <label className="field">
              <span>Контекст для модели</span>
              <textarea value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} />
            </label>
            {error ? <div className="error-banner">{error}</div> : null}
            {message ? <div className="success-banner">{message}</div> : null}
            <button className="button-primary" type="submit">
              Сохранить
            </button>
          </form>
        </section>

        <section className="surface">
          <div className="eyebrow">Обзор</div>
          <h2 className="surface-title">Что есть внутри</h2>
          <div className="toolbar-row">
            <span className="mini-badge">Чаты: {String(stats.chats || 0)}</span>
            <span className="mini-badge">Файлы: {String(stats.files || 0)}</span>
            <span className="mini-badge">Документы: {String(stats.documents || 0)}</span>
            <span className="mini-badge">Редактор: {String(stats.canvasDocs || 0)}</span>
          </div>
          <div className="feature-list" style={{ marginTop: 16 }}>
            <div className="feature-row">
              <strong>Инструкции проекта</strong>
              <span>{instructions.length ? `${instructions.length} записей` : "Пока не добавлены."}</span>
            </div>
            <div className="feature-row">
              <strong>Материалы</strong>
              <span>{files.length ? `${files.length} файлов уже привязаны к проекту.` : "Файлы ещё не добавлены."}</span>
            </div>
            <div className="feature-row">
              <strong>Результаты</strong>
              <span>{documents.length + canvasDocs.length ? "Документы и заметки уже появились." : "Пока нет итоговых материалов."}</span>
            </div>
          </div>
        </section>
      </div>

      <div className="content-grid two-columns">
        <section className="surface">
          <div className="eyebrow">Связанные чаты</div>
          <h2 className="surface-title">Диалоги проекта</h2>
          <div className="status-list">
            {chats.map((entry) => (
              <Link key={String((entry as Record<string, unknown>).id)} href="/chat" className="status-card">
                <strong>{String((entry as Record<string, unknown>).title || "Чат")}</strong>
              </Link>
            ))}
            {chats.length === 0 ? <div className="muted-text">Пока нет связанных чатов.</div> : null}
          </div>
        </section>

        <section className="surface">
          <div className="eyebrow">Файлы и результаты</div>
          <h2 className="surface-title">Материалы проекта</h2>
          <div className="status-list">
            {files.map((entry) => (
              <div key={String((entry as Record<string, unknown>).id)} className="status-card">
                <strong>{String(((entry as Record<string, unknown>).file as Record<string, unknown> | null)?.originalName || "Файл")}</strong>
              </div>
            ))}
            {documents.map((entry) => (
              <div key={String((entry as Record<string, unknown>).id)} className="status-card">
                <strong>{String(((entry as Record<string, unknown>).document as Record<string, unknown> | null)?.title || "Документ")}</strong>
              </div>
            ))}
            {canvasDocs.map((entry) => (
              <div key={String((entry as Record<string, unknown>).id)} className="status-card">
                <strong>{String((entry as Record<string, unknown>).title || "Заметка")}</strong>
              </div>
            ))}
            {files.length === 0 && documents.length === 0 && canvasDocs.length === 0 ? <div className="muted-text">Пока здесь пусто.</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
