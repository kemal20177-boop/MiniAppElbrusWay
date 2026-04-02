"use client";

import { FormEvent, useEffect, useState } from "react";

type DocumentSection = { key: string; title: string; content: string };
type DocumentItem = {
  id: string;
  title: string;
  summary: string | null;
  templateKey?: string | null;
  source: { sections?: DocumentSection[] };
  versions: Array<{ version: number }>;
  exports: Array<{ id: string; format: string; createdAt: string }>;
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeId, setActiveId] = useState<string>("");
  const [editingSectionKey, setEditingSectionKey] = useState("");
  const [editingContent, setEditingContent] = useState("");

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/documents");
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message || "Не удалось загрузить документы");
        return;
      }
      setDocuments(payload.data.documents || []);
      if (!activeId && payload.data.documents?.[0]?.id) {
        setActiveId(payload.data.documents[0].id);
      }
    })();
  }, [activeId]);

  async function loadDocuments() {
    const response = await fetch("/api/documents");
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось загрузить документы");
      return;
    }
    setDocuments(payload.data.documents || []);
    if (!activeId && payload.data.documents?.[0]?.id) {
      setActiveId(payload.data.documents[0].id);
    }
  }

  async function createDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const response = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, prompt, template: "spec", tone: "technical", structure: "standard", length: "medium" })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось создать документ");
      return;
    }
    setTitle("");
    setPrompt("");
    setActiveId(payload.data.document.id);
    setMessage("Документ создан");
    await loadDocuments();
  }

  async function exportDocument(documentId: string, format: string) {
    const response = await fetch(`/api/documents/${documentId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось подготовить экспорт");
      return;
    }
    setMessage(`Экспорт ${format} подготовлен`);
    await loadDocuments();
  }

  async function saveSection(documentId: string, sectionKey: string) {
    const response = await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sectionKey,
        content: editingContent,
        regenerateSummary: true,
        changeSummary: "Обновление раздела"
      })
    });
    if (response.ok) {
      setEditingSectionKey("");
      setEditingContent("");
      setMessage("Раздел обновлён");
      await loadDocuments();
    }
  }

  const activeDocument = documents.find((entry) => entry.id === activeId) || null;
  const sections = activeDocument?.source?.sections || [];

  return (
    <div className="page-stack">
      <section className="surface">
        <div className="eyebrow">Документы</div>
        <h1 className="surface-title">Превращайте идеи, заметки и запросы в структурированные материалы.</h1>
        <p className="surface-copy">Документ можно создать, открыть по разделам, доработать вручную и быстро выгрузить в нужном формате.</p>
      </section>

      <div className="content-grid two-columns">
        <section className="surface">
          <div className="eyebrow">Новый документ</div>
          <h2 className="surface-title">Собрать с нуля</h2>
          <form onSubmit={createDocument} className="section-stack">
            <label className="field">
              <span>Название</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например: Коммерческое предложение" />
            </label>
            <label className="field">
              <span>Что нужно подготовить</span>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Опишите задачу простым языком: для кого документ, что в нём должно быть и какой нужен результат." />
            </label>
            {error ? <div className="error-banner">{error}</div> : null}
            {message ? <div className="success-banner">{message}</div> : null}
            <button className="button-primary" type="submit">
              Создать документ
            </button>
          </form>
        </section>

        <section className="surface">
          <div className="eyebrow">Список</div>
          <h2 className="surface-title">Ваши документы</h2>
          <div className="status-list">
            {documents.map((document) => (
              <button key={document.id} type="button" className={document.id === activeId ? "chat-list-card active" : "chat-list-card"} onClick={() => setActiveId(document.id)}>
                <strong>{document.title}</strong>
                <span className="muted-text">{document.summary || "Краткое описание появится после генерации."}</span>
              </button>
            ))}
            {documents.length === 0 ? <div className="muted-text">Пока нет документов.</div> : null}
          </div>
        </section>
      </div>

      {activeDocument ? (
        <section className="surface">
          <div className="toolbar-row" style={{ justifyContent: "space-between" }}>
            <div className="feature-row">
              <strong>{activeDocument.title}</strong>
              <span>Версий: {activeDocument.versions.length} · Экспортов: {activeDocument.exports.length}</span>
            </div>
            <div className="toolbar-row">
              {["PDF", "DOCX", "PPTX", "MD", "TXT"].map((format) => (
                <button key={format} type="button" className="button-secondary" onClick={() => void exportDocument(activeDocument.id, format)}>
                  {format}
                </button>
              ))}
              <a href="/canvas" className="button-primary">
                Открыть редактор
              </a>
            </div>
          </div>

          <div className="status-list" style={{ marginTop: 18 }}>
            {sections.map((section) => (
              <article key={section.key} className="status-card">
                <strong>{section.title}</strong>
                {editingSectionKey === section.key ? (
                  <div className="section-stack">
                    <textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} rows={10} />
                    <div className="toolbar-row">
                      <button className="button-primary" type="button" onClick={() => void saveSection(activeDocument.id, section.key)}>
                        Сохранить
                      </button>
                      <button className="button-ghost" type="button" onClick={() => { setEditingSectionKey(""); setEditingContent(""); }}>
                        Отменить
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{section.content}</div>
                    <div className="toolbar-row">
                      <button className="button-secondary" type="button" onClick={() => { setEditingSectionKey(section.key); setEditingContent(section.content); }}>
                        Редактировать
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
