"use client";

import { FormEvent, useEffect, useState } from "react";

type Project = { id: string; title: string };
type UserFile = { id: string; originalName: string };
type Chat = { id: string; title: string };

export default function DocumentsToolPage() {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [template, setTemplate] = useState("spec");
  const [tone, setTone] = useState("technical");
  const [structure, setStructure] = useState("standard");
  const [length, setLength] = useState("medium");
  const [projectId, setProjectId] = useState("");
  const [sourceFileId, setSourceFileId] = useState("");
  const [sourceChatId, setSourceChatId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [files, setFiles] = useState<UserFile[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const url = new URL(window.location.href);
    const query = url.searchParams.get("query");
    if (query) {
      setPrompt(query);
    }
    void Promise.all([loadProjects(), loadFiles(), loadChats()]);
  }, []);

  async function loadProjects() {
    const response = await fetch("/api/projects");
    const payload = await response.json();
    if (response.ok) {
      setProjects(payload.data.projects || []);
    }
  }

  async function loadFiles() {
    const response = await fetch("/api/files");
    const payload = await response.json();
    if (response.ok) {
      setFiles(payload.data.files || []);
    }
  }

  async function loadChats() {
    const response = await fetch("/api/chats");
    const payload = await response.json();
    if (response.ok) {
      setChats(payload.data.chats || []);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const response = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        prompt,
        projectId: projectId || undefined,
        sourceFileId: sourceFileId || undefined,
        sourceChatId: sourceChatId || undefined,
        template,
        tone,
        structure,
        length
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось создать документ");
      return;
    }

    setMessage(`Документ создан: ${payload.data.document.title}`);
    setTitle("");
    setPrompt("");
  }

  return (
    <main className="workspace-page">
      <section className="panel workspace-panel">
        <div className="badge">Documents Tool</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Генерация документов</h1>
        <form onSubmit={onSubmit} className="card" style={{ marginTop: 24, display: "grid", gap: 12, maxWidth: 980 }}>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Название документа" style={{ width: "100%", minHeight: 46, borderRadius: 14, padding: "0 14px", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={8} placeholder="Задача, по которой нужно собрать документ" className="card" style={{ padding: 14 }} />
          <div className="grid-3">
            <select value={template} onChange={(event) => setTemplate(event.target.value)} className="card" style={{ padding: 14 }}>
              <option value="spec">Spec</option>
              <option value="proposal">Proposal</option>
              <option value="report">Report</option>
              <option value="faq">FAQ</option>
              <option value="resume">Resume</option>
              <option value="presentation">Presentation</option>
              <option value="article">Article</option>
            </select>
            <select value={tone} onChange={(event) => setTone(event.target.value)} className="card" style={{ padding: 14 }}>
              <option value="technical">Technical</option>
              <option value="formal">Formal</option>
              <option value="executive">Executive</option>
              <option value="friendly">Friendly</option>
              <option value="neutral">Neutral</option>
            </select>
            <select value={structure} onChange={(event) => setStructure(event.target.value)} className="card" style={{ padding: 14 }}>
              <option value="brief">Brief</option>
              <option value="standard">Standard</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>
          <div className="grid-3">
            <select value={length} onChange={(event) => setLength(event.target.value)} className="card" style={{ padding: 14 }}>
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="card" style={{ padding: 14 }}>
              <option value="">Без проекта</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
            <select value={sourceFileId} onChange={(event) => setSourceFileId(event.target.value)} className="card" style={{ padding: 14 }}>
              <option value="">Source file</option>
              {files.map((file) => <option key={file.id} value={file.id}>{file.originalName}</option>)}
            </select>
          </div>
          <select value={sourceChatId} onChange={(event) => setSourceChatId(event.target.value)} className="card" style={{ padding: 14 }}>
            <option value="">Source chat</option>
            {chats.map((chat) => <option key={chat.id} value={chat.id}>{chat.title}</option>)}
          </select>
          {error ? <div style={{ color: "var(--error)" }}>{error}</div> : null}
          {message ? <div style={{ color: "var(--success)" }}>{message}</div> : null}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="button-primary" type="submit">Сгенерировать</button>
            <a className="button-secondary" href="/documents">Все документы</a>
            <a className="button-secondary" href="/canvas">Открыть canvas</a>
          </div>
        </form>
      </section>
    </main>
  );
}
