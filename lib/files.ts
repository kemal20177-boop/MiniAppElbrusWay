import "server-only";
import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { FileKind, FileStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DEFAULT_MAX_UPLOAD_MB = 25;
const DEFAULT_STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");
const allowedMimePrefixes = ["image/", "audio/", "video/", "text/"];
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/json",
  "application/xml",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
]);

function getStorageRoot() {
  return process.env.UPLOAD_STORAGE_DIR?.trim() || DEFAULT_STORAGE_ROOT;
}

function getMaxUploadBytes() {
  const raw = Number(process.env.MAX_UPLOAD_SIZE_MB || DEFAULT_MAX_UPLOAD_MB);
  const sizeMb = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_UPLOAD_MB;
  return sizeMb * 1024 * 1024;
}

function isMimeAllowed(mimeType: string) {
  const mime = mimeType.trim().toLowerCase();
  return allowedMimePrefixes.some((prefix) => mime.startsWith(prefix)) || allowedMimeTypes.has(mime);
}

async function ensureStorageRoot() {
  await mkdir(getStorageRoot(), { recursive: true });
}

function toSafeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 80) || "file";
}

function inferExtension(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]{1,12})$/);
  return match?.[1] || null;
}

function inferFileKind(params: { mimeType: string; extension: string | null }) {
  const mime = params.mimeType.toLowerCase();
  const ext = params.extension?.toLowerCase() || "";

  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"].includes(ext)) {
    return FileKind.IMAGE;
  }

  if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) {
    return FileKind.AUDIO;
  }

  if (mime.startsWith("video/") || ["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) {
    return FileKind.VIDEO;
  }

  if (
    mime.includes("pdf") ||
    mime.includes("text") ||
    mime.includes("json") ||
    mime.includes("xml") ||
    mime.includes("csv") ||
    ["pdf", "txt", "md", "csv", "json", "xml", "html", "htm", "doc", "docx", "ppt", "pptx"].includes(ext)
  ) {
    return FileKind.DOCUMENT;
  }

  if (["sql", "ts", "tsx", "js", "jsx", "py", "go", "rs", "java", "c", "cpp", "yaml", "yml"].includes(ext)) {
    return FileKind.DATA;
  }

  return FileKind.OTHER;
}

function cleanExtractedText(value: string) {
  return value
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 200_000);
}

function extractPrintablePdfText(buffer: Buffer) {
  const latin = buffer.toString("latin1");
  const fragments = latin.match(/[A-Za-zА-Яа-я0-9,.;:!?()[\]\/"'%+\-_ \n\r\t]{20,}/g) || [];
  return cleanExtractedText(fragments.join(" "));
}

function extractTextFromBuffer(buffer: Buffer, mimeType: string, extension: string | null) {
  const mime = mimeType.toLowerCase();
  const ext = extension?.toLowerCase() || "";

  if (
    mime.startsWith("text/") ||
    mime.includes("json") ||
    mime.includes("xml") ||
    mime.includes("javascript") ||
    ["txt", "md", "csv", "json", "xml", "html", "htm", "sql", "ts", "tsx", "js", "jsx", "py", "yml", "yaml"].includes(ext)
  ) {
    return cleanExtractedText(buffer.toString("utf8"));
  }

  if (mime.includes("pdf") || ext === "pdf") {
    return extractPrintablePdfText(buffer);
  }

  return null;
}

function buildMetadata(params: {
  mimeType: string;
  extension: string | null;
  kind: FileKind;
  extractedText: string | null;
  sizeBytes: number;
}) {
  const words = params.extractedText ? params.extractedText.split(/\s+/).filter(Boolean).length : 0;
  const lines = params.extractedText ? params.extractedText.split(/\r?\n/).length : 0;

  return {
    mimeType: params.mimeType,
    extension: params.extension,
    kind: params.kind,
    sizeBytes: params.sizeBytes,
    textLength: params.extractedText?.length || 0,
    wordCount: words,
    lineCount: lines
  };
}

function buildFilePreview(file: {
  kind: FileKind;
  originalName: string;
  extractedText: string | null;
  metadata: Prisma.JsonValue | null;
}) {
  const metadata = (file.metadata || {}) as Record<string, unknown>;

  return {
    info: {
      originalName: file.originalName,
      kind: file.kind,
      metadata
    },
    previewText: file.extractedText?.slice(0, 5000) || null
  };
}

function chunkText(text: string) {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n{2,}/).map((entry) => entry.trim()).filter(Boolean);
  let current = "";

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > 1800 && current) {
      chunks.push(current);
      current = paragraph;
      continue;
    }

    if (paragraph.length > 1800) {
      if (current) {
        chunks.push(current);
        current = "";
      }

      for (let index = 0; index < paragraph.length; index += 1800) {
        chunks.push(paragraph.slice(index, index + 1800));
      }
      continue;
    }

    current = next;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.slice(0, 200);
}

function summarizeFile(file: {
  originalName: string;
  kind: FileKind;
  mimeType: string;
  extractedText: string | null;
  metadata: Prisma.JsonValue | null;
  sizeBytes: number;
}) {
  const metadata = (file.metadata || {}) as Record<string, unknown>;
  const wordCount = Number(metadata.wordCount || 0);
  const text = file.extractedText?.trim();

  if (text) {
    const preview = text.slice(0, 600);
    return {
      summary: preview.length < text.length ? `${preview}...` : preview,
      insights: [
        `Файл ${file.originalName}`,
        `Тип: ${file.kind}`,
        `Размер: ${file.sizeBytes} bytes`,
        wordCount > 0 ? `Слов: ${wordCount}` : null
      ].filter(Boolean)
    };
  }

  return {
    summary: `Файл ${file.originalName} загружен. Для типа ${file.mimeType} текстовое извлечение недоступно.`,
    insights: [`Тип: ${file.kind}`, `Размер: ${file.sizeBytes} bytes`]
  };
}

async function upsertProjectLink(userId: string, projectId: string | undefined, fileId: string) {
  if (!projectId) {
    return;
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ownerId: userId,
      deletedAt: null
    },
    select: { id: true }
  });

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  await prisma.projectFile.upsert({
    where: {
      projectId_fileId: {
        projectId,
        fileId
      }
    },
    update: {},
    create: {
      projectId,
      fileId,
      userId
    }
  });
}

export async function listFilesForUser(userId: string, params?: { projectId?: string }) {
  const query = (params as { query?: string; kind?: FileKind; status?: FileStatus } | undefined)?.query;
  const kind = (params as { kind?: FileKind } | undefined)?.kind;
  const status = (params as { status?: FileStatus } | undefined)?.status;
  return prisma.userFile.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(query
        ? {
            OR: [
              { originalName: { contains: query, mode: "insensitive" } },
              { extractedText: { contains: query, mode: "insensitive" } }
            ]
          }
        : {}),
      ...(kind ? { kind } : {}),
      ...(status ? { status } : {}),
      ...(params?.projectId
        ? {
            projectFiles: {
              some: {
                projectId: params.projectId
              }
            }
          }
        : {})
    },
    include: {
      projectFiles: {
        include: {
          project: {
            select: {
              id: true,
              title: true,
              slug: true
            }
          }
        }
      },
      _count: {
        select: {
          chunks: true,
          chatAttachments: true
        }
      }
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });
}

export async function getFileForUser(userId: string, fileId: string) {
  return prisma.userFile.findFirst({
    where: {
      id: fileId,
      userId,
      deletedAt: null
    },
    include: {
      chunks: {
        orderBy: { chunkIndex: "asc" },
        take: 50
      },
      projectFiles: {
        include: {
          project: {
            select: {
              id: true,
              title: true,
              slug: true
            }
          }
        }
      }
    }
  });
}

async function persistFileRecord(params: {
  userId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  projectId?: string;
}) {
  await ensureStorageRoot();
  const extension = inferExtension(params.fileName);
  const kind = inferFileKind({
    mimeType: params.mimeType,
    extension
  });
  const sha256 = createHash("sha256").update(params.bytes).digest("hex");
  const existing = await prisma.userFile.findFirst({
    where: {
      userId: params.userId,
      sha256,
      sizeBytes: params.bytes.byteLength,
      deletedAt: null
    }
  });

  if (existing) {
    await upsertProjectLink(params.userId, params.projectId, existing.id);
    return existing;
  }

  const today = new Date();
  const storageKey = path.join(
    String(today.getUTCFullYear()),
    String(today.getUTCMonth() + 1).padStart(2, "0"),
    `${randomUUID()}-${toSafeSegment(params.fileName)}`
  );
  const absolutePath = path.join(getStorageRoot(), storageKey);

  const created = await prisma.userFile.create({
    data: {
      userId: params.userId,
      storageKey,
      originalName: params.fileName,
      extension,
      mimeType: params.mimeType,
      kind,
      status: FileStatus.UPLOADING,
      sizeBytes: params.bytes.byteLength,
      sha256,
      previewUrl: "/api/files/pending/content"
    }
  });

  try {
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, params.bytes);
    const extractedText = extractTextFromBuffer(params.bytes, params.mimeType, extension);
    const metadata = buildMetadata({
      mimeType: params.mimeType,
      extension,
      kind,
      extractedText,
      sizeBytes: params.bytes.byteLength
    });

    const updated = await prisma.userFile.update({
      where: { id: created.id },
      data: {
        status: FileStatus.READY,
        extractedText,
        metadata,
        previewUrl: `/api/files/${created.id}/content?preview=1`
      }
    });

    if (extractedText) {
      const chunks = chunkText(extractedText);
      if (chunks.length > 0) {
        await prisma.fileChunk.createMany({
          data: chunks.map((content, index) => ({
            fileId: created.id,
            chunkIndex: index,
            content,
            tokenCount: Math.max(1, Math.ceil(content.length / 4))
          })),
          skipDuplicates: true
        });
      }
    }

    await upsertProjectLink(params.userId, params.projectId, created.id);
    return updated;
  } catch (error) {
    await prisma.userFile.update({
      where: { id: created.id },
      data: {
        status: FileStatus.FAILED,
        metadata: {
          error: error instanceof Error ? error.message : "UPLOAD_FAILED"
        }
      }
    });
    throw error;
  }
}

export async function getFileBufferForUser(userId: string, fileId: string) {
  const file = await prisma.userFile.findFirst({
    where: {
      id: fileId,
      userId,
      deletedAt: null
    }
  });

  if (!file) {
    throw new Error("FILE_NOT_FOUND");
  }

  const absolutePath = path.join(getStorageRoot(), file.storageKey);
  return {
    file,
    buffer: await readFile(absolutePath)
  };
}

export async function uploadUserFile(params: {
  userId: string;
  file: File;
  projectId?: string;
}) {
  if (!params.file.name) {
    throw new Error("FILE_NAME_REQUIRED");
  }

  if (params.file.size <= 0) {
    throw new Error("FILE_EMPTY");
  }

  if (params.file.size > getMaxUploadBytes()) {
    throw new Error("FILE_TOO_LARGE");
  }
  const mimeType = params.file.type || "application/octet-stream";
  if (!isMimeAllowed(mimeType)) {
    throw new Error("FILE_TYPE_NOT_ALLOWED");
  }

  return persistFileRecord({
    userId: params.userId,
    fileName: params.file.name,
    mimeType,
    bytes: Buffer.from(await params.file.arrayBuffer()),
    projectId: params.projectId
  });
}

export async function uploadManyUserFiles(params: {
  userId: string;
  files: File[];
  projectId?: string;
}) {
  const uploaded = [];
  const errors: Array<{ fileName: string; message: string }> = [];

  for (const file of params.files) {
    try {
      uploaded.push(await uploadUserFile({ userId: params.userId, file, projectId: params.projectId }));
    } catch (error) {
      errors.push({
        fileName: file.name,
        message: error instanceof Error ? error.message : "UPLOAD_FAILED"
      });
    }
  }

  return { uploaded, errors };
}

export async function createArtifactFileForUser(params: {
  userId: string;
  fileName: string;
  mimeType: string;
  content: string | Buffer;
  projectId?: string;
}) {
  const bytes = Buffer.isBuffer(params.content) ? params.content : Buffer.from(params.content, "utf8");
  return persistFileRecord({
    userId: params.userId,
    fileName: params.fileName,
    mimeType: params.mimeType,
    bytes,
    projectId: params.projectId
  });
}

function analyzeDocumentFile(file: {
  originalName: string;
  extractedText: string | null;
  sizeBytes: number;
}) {
  const text = file.extractedText?.trim() || "";
  const paragraphs = text.split(/\n{2,}/).filter(Boolean);
  const headings = text.split(/\n/).filter((line) => /^#{1,6}\s+/.test(line) || /^[A-ZА-Я0-9][^.!?]{0,80}$/.test(line));

  return {
    mode: "document",
    summary: text.slice(0, 700) || `Файл ${file.originalName} загружен.`,
    keyPoints: paragraphs.slice(0, 5),
    structure: headings.slice(0, 12),
    sizeBytes: file.sizeBytes
  };
}

function analyzeDataFile(file: {
  originalName: string;
  extractedText: string | null;
}) {
  const text = file.extractedText?.trim() || "";
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines[0]?.split(/[,\t;|]/).map((cell) => cell.trim()).filter(Boolean) || [];

  return {
    mode: "data",
    summary: text.slice(0, 500) || `Файл ${file.originalName} загружен.`,
    schema: header,
    rowsPreview: lines.slice(1, 6),
    rowCountEstimate: Math.max(0, lines.length - 1)
  };
}

function analyzeImageFile(file: {
  originalName: string;
  metadata: Prisma.JsonValue | null;
}) {
  return {
    mode: "vision",
    summary: `Изображение ${file.originalName} готово к vision analysis.`,
    tasks: ["ocr", "describe", "screenshot-analysis", "chart-analysis", "ask"],
    metadata: file.metadata
  };
}

function analyzeAudioFile(file: { originalName: string; mimeType: string; sizeBytes: number }) {
  return {
    mode: "audio",
    summary: `Аудиофайл ${file.originalName} готов к transcription pipeline.`,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes
  };
}

function analyzeVideoFile(file: { originalName: string; mimeType: string; sizeBytes: number }) {
  return {
    mode: "video",
    summary: `Видео ${file.originalName} готово к metadata/stub pipeline.`,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes
  };
}

export async function analyzeFileForUser(userId: string, fileId: string) {
  const file = await prisma.userFile.findFirst({
    where: {
      id: fileId,
      userId,
      deletedAt: null
    }
  });

  if (!file) {
    throw new Error("FILE_NOT_FOUND");
  }

  const analysis =
    file.kind === FileKind.DOCUMENT
      ? analyzeDocumentFile(file)
      : file.kind === FileKind.DATA
        ? analyzeDataFile(file)
        : file.kind === FileKind.IMAGE
          ? analyzeImageFile(file)
          : file.kind === FileKind.AUDIO
            ? analyzeAudioFile(file)
            : file.kind === FileKind.VIDEO
              ? analyzeVideoFile(file)
              : summarizeFile(file);
  await prisma.userFile.update({
    where: { id: file.id },
    data: {
      metadata: {
        ...((file.metadata || {}) as Record<string, unknown>),
        analysis
      }
    }
  });

  return analysis;
}

export async function deleteFileForUser(userId: string, fileId: string) {
  const file = await prisma.userFile.findFirst({
    where: {
      id: fileId,
      userId,
      deletedAt: null
    }
  });

  if (!file) {
    throw new Error("FILE_NOT_FOUND");
  }

  await prisma.userFile.update({
    where: { id: file.id },
    data: {
      deletedAt: new Date(),
      status: FileStatus.DELETED
    }
  });

  try {
    await rm(path.join(getStorageRoot(), file.storageKey), { force: true });
  } catch {}

  return file;
}

export async function attachFilesToChat(params: {
  userId: string;
  chatId: string;
  messageId?: string;
  fileIds: string[];
}) {
  if (params.fileIds.length === 0) {
    return [];
  }

  const files = await prisma.userFile.findMany({
    where: {
      id: { in: params.fileIds },
      userId: params.userId,
      deletedAt: null,
      status: FileStatus.READY
    }
  });

  if (files.length !== params.fileIds.length) {
    throw new Error("ATTACHMENT_NOT_FOUND");
  }

  for (const file of files) {
    await prisma.chatAttachment.create({
      data: {
        chatId: params.chatId,
        messageId: params.messageId || null,
        userId: params.userId,
        fileId: file.id
      }
    });
  }

  return files;
}

export async function buildAttachmentContext(userId: string, fileIds: string[]) {
  if (fileIds.length === 0) {
    return [];
  }

  const files = await prisma.userFile.findMany({
    where: {
      id: { in: fileIds },
      userId,
      deletedAt: null,
      status: FileStatus.READY
    },
    include: {
      chunks: {
        orderBy: { chunkIndex: "asc" },
        take: 6
      }
    }
  });

  if (files.length !== fileIds.length) {
    throw new Error("ATTACHMENT_NOT_FOUND");
  }

  return files.map((file) => {
    const analysis = summarizeFile(file);
    const excerpt = file.chunks.map((chunk) => chunk.content).join("\n\n").slice(0, 3000);

    return {
      id: file.id,
      name: file.originalName,
      mimeType: file.mimeType,
      kind: file.kind,
      summary: analysis.summary,
      excerpt
    };
  });
}

export async function fileExistsForUser(userId: string, fileId: string) {
  const file = await prisma.userFile.findFirst({
    where: {
      id: fileId,
      userId,
      deletedAt: null
    },
    select: { id: true }
  });

  return Boolean(file);
}

export async function getFileStatsForUser(userId: string) {
  const [count, sizeAggregate] = await Promise.all([
    prisma.userFile.count({
      where: {
        userId,
        deletedAt: null
      }
    }),
    prisma.userFile.aggregate({
      where: {
        userId,
        deletedAt: null
      },
      _sum: {
        sizeBytes: true
      }
    })
  ]);

  return {
    count,
    totalBytes: Number(sizeAggregate._sum.sizeBytes || 0)
  };
}

export async function buildFilePreviewForUser(userId: string, fileId: string) {
  const file = await getFileForUser(userId, fileId);
  if (!file) {
    throw new Error("FILE_NOT_FOUND");
  }

  return {
    ...buildFilePreview(file),
    chunks: file.chunks.slice(0, 12)
  };
}
