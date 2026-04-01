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
  const [activeId, setActiveId] = useState<string>("");
  const [editingSectionKey, setEditingSectionKey] = useState("");
  const [editingContent, setEditingContent] = useState("");

  useEffect(() => {
    void loadDocuments();
  }, []);

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
      setError(payload.error?.message || "Не удалось экспортировать документ");
      return;
    }
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
        changeSummary: `Updated section ${sectionKey}`
      })
    });
    if (response.ok) {
      setEditingSectionKey("");
      setEditingContent("");
      await loadDocuments();
    }
  }

  async function regenerateSection(documentId: string, section: DocumentSection) {
    const response = await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sectionKey: section.key,
        content: `${section.content}\n\nRegenerated with additional detail and tighter structure.`,
        regenerateSummary: true,
        changeSummary: `Regenerated section ${section.key}`
      })
    });
    if (response.ok) await loadDocuments();
  }

  const activeDocument = documents.find((entry) => entry.id === activeId) || null;
  const sections = activeDocument?.source?.sections || [];

  return (
    <main className="workspace-page">
      <section className="panel workspace-panel">
        <div className="badge">Documents</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Documents</h1>
        {error ? <div style={{ color: "var(--error)", marginTop: 12 }}>{error}</div> : null}

        <div className="grid-3" style={{ marginTop: 24 }}>
          <form className="card" onSubmit={createDocument}>
            <h2 style={{ marginTop: 0 }}>Новый документ</h2>
            <div style={{ display: "grid", gap: 10 }}>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Название" style={{ width: "100%", minHeight: 46, borderRadius: 14, padding: "0 14px", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Что нужно сгенерировать?" rows={8} className="card" style={{ padding: 14 }} />
              <button className="button-primary" type="submit">Создать документ</button>
            </div>
          </form>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Список</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {documents.map((document) => (
                <button key={document.id} type="button" className="card" onClick={() => setActiveId(document.id)} style={{ padding: 16, textAlign: "left", background: document.id === activeId ? "rgba(30,111,217,0.18)" : "rgba(255,255,255,0.03)" }}>
                  <div style={{ fontWeight: 700 }}>{document.title}</div>
                  <div className="muted" style={{ marginTop: 6 }}>{document.templateKey || "template?"} · {document.summary || "Без summary"}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            {!activeDocument ? <div className="muted">Выберите документ</div> : (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontWeight: 800 }}>{activeDocument.title}</div>
                <div className="muted">Версий: {activeDocument.versions.length} · Экспортов: {activeDocument.exports.length}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["PDF", "DOCX", "PPTX", "MD", "TXT"].map((format) => <button key={format} type="button" className="button-secondary" onClick={() => void exportDocument(activeDocument.id, format)}>{format}</button>)}
                  <a className="button-primary" href="/canvas">Canvas</a>
                </div>
              </div>
            )}
          </div>
        </div>

        {activeDocument ? (
          <div className="card" style={{ marginTop: 24 }}>
            <h2 style={{ marginTop: 0 }}>Разделы</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {sections.map((section) => (
                <div key={section.key} className="card" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 700 }}>{section.title}</div>
                  {editingSectionKey === section.key ? (
                    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                      <textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} rows={10} className="card" style={{ padding: 14 }} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="button-primary" type="button" onClick={() => void saveSection(activeDocument.id, section.key)}>Сохранить</button>
                        <button className="button-secondary" type="button" onClick={() => { setEditingSectionKey(""); setEditingContent(""); }}>Отменить</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                      <div className="card" style={{ whiteSpace: "pre-wrap" }}>{section.content}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="button-secondary" type="button" onClick={() => { setEditingSectionKey(section.key); setEditingContent(section.content); }}>Редактировать раздел</button>
                        <button className="button-secondary" type="button" onClick={() => void regenerateSection(activeDocument.id, section)}>Перегенерировать раздел</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
