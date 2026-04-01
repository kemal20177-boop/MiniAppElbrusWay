"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";

type UserFileItem = {
  id: string;
  originalName: string;
  mimeType: string;
  kind: string;
  status: string;
  sizeBytes: number;
  extractedText: string | null;
  previewUrl: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  chunks?: Array<{ id: string; chunkIndex: number; content: string }>;
};

type Project = { id: string; title: string };
type Chat = { id: string; title: string };

export default function FilesPage() {
  const [files, setFiles] = useState<UserFileItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<UserFileItem | null>(null);
  const [tab, setTab] = useState<"info" | "content" | "analysis" | "chunks">("info");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [projectTarget, setProjectTarget] = useState("");
  const [chatTarget, setChatTarget] = useState("");

  useEffect(() => {
    void Promise.all([loadFiles(), loadProjects(), loadChats()]);
  }, []);

  async function loadFiles() {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (kind) params.set("kind", kind);
    const response = await fetch(`/api/files?${params.toString()}`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось загрузить файлы");
      return;
    }
    setFiles(payload.data.files || []);
  }

  async function loadProjects() {
    const response = await fetch("/api/projects");
    const payload = await response.json();
    if (response.ok) setProjects(payload.data.projects || []);
  }

  async function loadChats() {
    const response = await fetch("/api/chats");
    const payload = await response.json();
    if (response.ok) setChats(payload.data.chats || []);
  }

  async function openFile(fileId: string) {
    const response = await fetch(`/api/files/${fileId}`);
    const payload = await response.json();
    if (response.ok) setSelectedFile(payload.data.file);
  }

  async function uploadMany(fileList: FileList | File[]) {
    setUploading(true);
    setProgressText(`Uploading ${Array.from(fileList).length} files...`);
    setError("");
    const formData = new FormData();
    Array.from(fileList).forEach((file) => formData.append("files", file));
    const response = await fetch("/api/files", { method: "POST", body: formData });
    const payload = await response.json();
    setUploading(false);
    setProgressText("");
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось загрузить файлы");
      return;
    }
    await loadFiles();
  }

  async function runAnalysis(fileId: string) {
    const response = await fetch(`/api/files/${fileId}/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "summary" }) });
    if (response.ok) {
      await openFile(fileId);
      await loadFiles();
    }
  }

  async function bulkAction(action: "delete" | "attachToChat" | "addToProject") {
    const response = await fetch("/api/files/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileIds: selectedIds,
        action,
        chatId: chatTarget || undefined,
        projectId: projectTarget || undefined
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось выполнить bulk action");
      return;
    }
    await loadFiles();
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.dataTransfer.files?.length) {
      void uploadMany(event.dataTransfer.files);
    }
  }

  const filtered = useMemo(() => files, [files]);
  const analysis = selectedFile?.metadata?.analysis as Record<string, unknown> | undefined;

  return (
    <main className="workspace-page">
      <section className="panel workspace-panel" onDrop={onDrop} onDragOver={(event) => event.preventDefault()}>
        <div className="badge">Файлы</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Центр файлов</h1>
        <p className="section-copy" style={{ maxWidth: 820 }}>
          Здесь работают массовая загрузка, drag-and-drop, предпросмотр, анализ и быстрые действия для привязки файлов к чату или проекту.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
          <label className="button-primary" style={{ cursor: "pointer" }}>
            {uploading ? "Загрузка..." : "Загрузить файлы"}
            <input type="file" hidden multiple onChange={(event: ChangeEvent<HTMLInputElement>) => { if (event.target.files?.length) void uploadMany(event.target.files); }} />
          </label>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по файлам" style={{ minHeight: 42, borderRadius: 12, padding: "0 12px", border: "1px solid var(--border)", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)" }} />
          <select value={kind} onChange={(event) => setKind(event.target.value)} style={{ minHeight: 42, borderRadius: 12, padding: "0 12px", border: "1px solid var(--border)", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)" }}>
            <option value="">Все типы</option>
            {["DOCUMENT", "IMAGE", "DATA", "AUDIO", "VIDEO", "OTHER"].map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
          <button className="button-secondary" type="button" onClick={() => void loadFiles()}>Применить</button>
          <a className="button-secondary" href="/tools/vision">Зрение</a>
        </div>

        <div style={{ marginTop: 12 }} className="muted">{progressText || "Перетащи файлы на страницу для загрузки."}</div>
        {error ? <div style={{ color: "var(--error)", marginTop: 14 }}>{error}</div> : null}

        <div className="grid-3" style={{ marginTop: 24 }}>
          <div className="card" style={{ display: "grid", gap: 12 }}>
            <h2 style={{ margin: 0 }}>Файлы</h2>
            {filtered.map((file) => (
              <div key={file.id} className="card" style={{ padding: 14, background: selectedFile?.id === file.id ? "rgba(30,111,217,0.18)" : "rgba(255,255,255,0.03)" }}>
                <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input type="checkbox" checked={selectedIds.includes(file.id)} onChange={(event) => setSelectedIds((prev) => event.target.checked ? [...prev, file.id] : prev.filter((entry) => entry !== file.id))} />
                  <button type="button" onClick={() => void openFile(file.id)} style={{ all: "unset", cursor: "pointer" }}>
                    <div style={{ fontWeight: 700 }}>{file.originalName}</div>
                    <div className="muted" style={{ marginTop: 6 }}>{file.kind} · {file.status}</div>
                  </button>
                </label>
              </div>
            ))}
          </div>

          <div className="card" style={{ gridColumn: "span 2" }}>
            {!selectedFile ? <div className="muted">Выбери файл слева</div> : (
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 20 }}>{selectedFile.originalName}</div>
                  <div className="muted" style={{ marginTop: 6 }}>{selectedFile.mimeType} · {selectedFile.kind} · {new Date(selectedFile.createdAt).toLocaleString("ru-RU")}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(["info", "content", "analysis", "chunks"] as const).map((entry) => (
                    <button key={entry} className={tab === entry ? "button-primary" : "button-secondary"} type="button" onClick={() => setTab(entry)}>{entry === "info" ? "Инфо" : entry === "content" ? "Содержимое" : entry === "analysis" ? "Анализ" : "Чанки"}</button>
                  ))}
                  <button className="button-secondary" type="button" onClick={() => void runAnalysis(selectedFile.id)}>Проанализировать</button>
                  <a className="button-secondary" href={`/tools/vision`}>Открыть в зрении</a>
                  <a className="button-secondary" href="/canvas">Открыть в канвасе</a>
                  <a className="button-secondary" href={`/tools/documents?query=${encodeURIComponent(selectedFile.originalName)}`}>Создать документ</a>
                </div>
                <div className="card" style={{ whiteSpace: "pre-wrap", maxHeight: 420, overflow: "auto" }}>
                  {tab === "info" ? JSON.stringify({ id: selectedFile.id, status: selectedFile.status, sizeBytes: selectedFile.sizeBytes, metadata: selectedFile.metadata }, null, 2) : null}
                  {tab === "content" ? selectedFile.extractedText || "Предпросмотр текста недоступен" : null}
                  {tab === "analysis" ? JSON.stringify(analysis || {}, null, 2) : null}
                  {tab === "chunks" ? JSON.stringify(selectedFile.chunks || [], null, 2) : null}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <strong>Групповые действия</strong>
            <select value={projectTarget} onChange={(event) => setProjectTarget(event.target.value)} style={{ minHeight: 40, borderRadius: 12, padding: "0 12px", border: "1px solid var(--border)", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)" }}>
              <option value="">Выбери проект</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
            <select value={chatTarget} onChange={(event) => setChatTarget(event.target.value)} style={{ minHeight: 40, borderRadius: 12, padding: "0 12px", border: "1px solid var(--border)", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)" }}>
              <option value="">Выбери чат</option>
              {chats.map((chat) => <option key={chat.id} value={chat.id}>{chat.title}</option>)}
            </select>
            <button className="button-secondary" type="button" disabled={!selectedIds.length} onClick={() => void bulkAction("attachToChat")}>Прикрепить к чату</button>
            <button className="button-secondary" type="button" disabled={!selectedIds.length} onClick={() => void bulkAction("addToProject")}>Добавить в проект</button>
            <button className="button-ghost" type="button" disabled={!selectedIds.length} onClick={() => void bulkAction("delete")}>Удалить</button>
          </div>
        </div>
      </section>
    </main>
  );
}
