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

function formatKind(kind: string) {
  if (kind === "DOCUMENT") return "Документ";
  if (kind === "IMAGE") return "Изображение";
  if (kind === "AUDIO") return "Аудио";
  if (kind === "VIDEO") return "Видео";
  if (kind === "DATA") return "Данные";
  return "Файл";
}

export default function FilesPage() {
  const [files, setFiles] = useState<UserFileItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<UserFileItem | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [projectTarget, setProjectTarget] = useState("");
  const [chatTarget, setChatTarget] = useState("");

  useEffect(() => {
    void (async () => {
      const [filesResponse, projectsResponse, chatsResponse] = await Promise.all([
        fetch("/api/files"),
        fetch("/api/projects"),
        fetch("/api/chats")
      ]);
      const [filesPayload, projectsPayload, chatsPayload] = await Promise.all([
        filesResponse.json(),
        projectsResponse.json(),
        chatsResponse.json()
      ]);
      if (filesResponse.ok) {
        setFiles(filesPayload.data.files || []);
      }
      if (projectsResponse.ok) {
        setProjects(projectsPayload.data.projects || []);
      }
      if (chatsResponse.ok) {
        setChats(chatsPayload.data.chats || []);
      }
    })();
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
    setError("");
    setMessage("");
    const formData = new FormData();
    Array.from(fileList).forEach((file) => formData.append("files", file));
    const response = await fetch("/api/files", { method: "POST", body: formData });
    const payload = await response.json();
    setUploading(false);
    if (!response.ok) {
      setError(payload.error?.message || "Не удалось загрузить файлы");
      return;
    }
    setMessage(`Загружено файлов: ${payload.data.files?.length || 0}`);
    await loadFiles();
  }

  async function runAnalysis(fileId: string) {
    const response = await fetch(`/api/files/${fileId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "summary" })
    });
    if (response.ok) {
      setMessage("Файл проанализирован");
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
      setError(payload.error?.message || "Не удалось выполнить действие");
      return;
    }
    setMessage("Действие выполнено");
    await loadFiles();
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.dataTransfer.files?.length) {
      void uploadMany(event.dataTransfer.files);
    }
  }

  const filtered = useMemo(() => files, [files]);

  return (
    <div className="page-stack">
      <section className="surface" onDrop={onDrop} onDragOver={(event) => event.preventDefault()}>
        <div className="eyebrow">Файлы</div>
        <h1 className="surface-title">Все загруженные материалы в одном месте.</h1>
        <p className="surface-copy">Здесь можно загрузить файлы, быстро найти нужный, открыть содержимое и отправить материал в чат или проект.</p>
      </section>

      <div className="content-grid two-columns">
        <section className="surface">
          <div className="toolbar-row">
            <label className="button-primary" style={{ cursor: "pointer" }}>
              {uploading ? "Загружаем..." : "Загрузить файлы"}
              <input
                type="file"
                hidden
                multiple
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  if (event.target.files?.length) void uploadMany(event.target.files);
                }}
              />
            </label>
            <a href="/tools/vision" className="button-secondary">
              Анализ изображений
            </a>
          </div>
          <div className="content-grid two-columns" style={{ marginTop: 16 }}>
            <label className="field">
              <span>Поиск</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название или фрагмент текста" />
            </label>
            <label className="field">
              <span>Тип</span>
              <select value={kind} onChange={(event) => setKind(event.target.value)}>
                <option value="">Все</option>
                {["DOCUMENT", "IMAGE", "DATA", "AUDIO", "VIDEO", "OTHER"].map((entry) => (
                  <option key={entry} value={entry}>
                    {formatKind(entry)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="toolbar-row" style={{ marginTop: 14 }}>
            <button className="button-secondary" type="button" onClick={() => void loadFiles()}>
              Обновить список
            </button>
            <span className="muted-text">Можно просто перетащить файлы на экран.</span>
          </div>
          {error ? <div className="error-banner" style={{ marginTop: 16 }}>{error}</div> : null}
          {message ? <div className="success-banner" style={{ marginTop: 16 }}>{message}</div> : null}

          <div className="status-list" style={{ marginTop: 18 }}>
            {filtered.map((file) => (
              <article key={file.id} className="status-card">
                <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(file.id)}
                    onChange={(event) =>
                      setSelectedIds((prev) => (event.target.checked ? [...prev, file.id] : prev.filter((entry) => entry !== file.id)))
                    }
                  />
                  <button type="button" onClick={() => void openFile(file.id)} style={{ all: "unset", cursor: "pointer", display: "grid", gap: 6, width: "100%" }}>
                    <strong>{file.originalName}</strong>
                    <span className="muted-text">
                      {formatKind(file.kind)} · {file.status.toLowerCase()} · {new Date(file.createdAt).toLocaleString("ru-RU")}
                    </span>
                  </button>
                </label>
              </article>
            ))}
            {filtered.length === 0 ? <div className="muted-text">Файлов пока нет.</div> : null}
          </div>
        </section>

        <section className="surface">
          {!selectedFile ? (
            <div className="muted-text">Выберите файл слева, чтобы посмотреть содержимое и быстрые действия.</div>
          ) : (
            <div className="section-stack">
              <div>
                <div className="eyebrow">Выбранный файл</div>
                <h2 className="surface-title">{selectedFile.originalName}</h2>
                <p className="surface-copy">
                  {formatKind(selectedFile.kind)} · {selectedFile.mimeType} · {new Date(selectedFile.createdAt).toLocaleString("ru-RU")}
                </p>
              </div>
              <div className="toolbar-row">
                <button className="button-secondary" type="button" onClick={() => void runAnalysis(selectedFile.id)}>
                  Обновить анализ
                </button>
                <a className="button-secondary" href="/canvas">
                  Открыть в редакторе
                </a>
                <a className="button-secondary" href={`/tools/documents?query=${encodeURIComponent(selectedFile.originalName)}`}>
                  Создать документ
                </a>
              </div>
              <div className="status-card" style={{ whiteSpace: "pre-wrap", maxHeight: 360, overflow: "auto" }}>
                {selectedFile.extractedText || "Для этого файла пока нет текстового предпросмотра."}
              </div>
            </div>
          )}

          <div className="section-stack" style={{ marginTop: 18 }}>
            <div>
              <div className="eyebrow">Групповые действия</div>
              <h2 className="surface-title">Работа с выбранными файлами</h2>
            </div>
            <label className="field">
              <span>Проект</span>
              <select value={projectTarget} onChange={(event) => setProjectTarget(event.target.value)}>
                <option value="">Выберите проект</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Чат</span>
              <select value={chatTarget} onChange={(event) => setChatTarget(event.target.value)}>
                <option value="">Выберите чат</option>
                {chats.map((chat) => (
                  <option key={chat.id} value={chat.id}>
                    {chat.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="toolbar-row">
              <button className="button-secondary" type="button" disabled={!selectedIds.length} onClick={() => void bulkAction("attachToChat")}>
                Добавить в чат
              </button>
              <button className="button-secondary" type="button" disabled={!selectedIds.length} onClick={() => void bulkAction("addToProject")}>
                Добавить в проект
              </button>
              <button className="button-ghost" type="button" disabled={!selectedIds.length} onClick={() => void bulkAction("delete")}>
                Удалить
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
