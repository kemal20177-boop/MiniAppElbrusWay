import "server-only";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { DocumentExportFormat, DocumentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFileForUser } from "@/lib/files";

const exportsRoot = path.join(process.cwd(), "storage", "exports");

type DocumentTemplate = "proposal" | "report" | "spec" | "faq" | "resume" | "presentation" | "article";
type DocumentTone = "neutral" | "formal" | "executive" | "friendly" | "technical";
type DocumentStructure = "brief" | "standard" | "detailed";
type DocumentLength = "short" | "medium" | "long";
type DocumentSection = {
  key: string;
  title: string;
  content: string;
};
type DocumentSourceModel = {
  format: "structured-markdown";
  template: DocumentTemplate;
  tone: DocumentTone;
  structure: DocumentStructure;
  length: DocumentLength;
  prompt: string;
  sections: DocumentSection[];
  metadata?: Record<string, unknown>;
};

function markdownToPlainText(markdown: string) {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1 ($2)")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .trim();
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s-]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
}

function getTemplateSections(template: DocumentTemplate, structure: DocumentStructure) {
  const detail = structure === "detailed";
  const brief = structure === "brief";

  switch (template) {
    case "proposal":
      return ["Контекст", "Цель", "Предложение", "План внедрения", detail ? "Риски и trade-offs" : "Риски", "Следующие шаги"];
    case "report":
      return ["Резюме", "Контекст", "Наблюдения", "Метрики", detail ? "Выводы и рекомендации" : "Рекомендации"];
    case "spec":
      return ["Резюме", "Требования", "Архитектура", "API и данные", "Ограничения", "Критерии приёмки"];
    case "faq":
      return brief ? ["Обзор", "FAQ"] : ["Обзор", "Для кого это", "FAQ", "Следующие шаги"];
    case "resume":
      return ["Позиционирование", "Опыт", "Навыки", "Достижения", "Контакты"];
    case "presentation":
      return ["Титульный слайд", "Проблема", "Решение", "План", "Итог"];
    default:
      return ["Введение", "Основная часть", "Ключевые тезисы", "Заключение"];
  }
}

function generateDocumentSection(params: {
  template: DocumentTemplate;
  sectionTitle: string;
  prompt: string;
  tone: DocumentTone;
  length: DocumentLength;
  sourceExcerpt?: string;
}) {
  const toneLabel =
    params.tone === "formal"
      ? "Формальный тон"
      : params.tone === "executive"
        ? "Executive summary стиль"
        : params.tone === "technical"
          ? "Техническая подача"
          : params.tone === "friendly"
            ? "Дружелюбная подача"
            : "Нейтральный тон";
  const lengthLines = params.length === "long" ? 4 : params.length === "medium" ? 3 : 2;
  const lines = [
    `${toneLabel}. Раздел "${params.sectionTitle}" для шаблона ${params.template}.`,
    `Основной фокус: ${params.prompt}.`,
    params.sourceExcerpt ? `Контекст из источника: ${params.sourceExcerpt}.` : null,
    `Практический акцент: что нужно сделать, проверить и зафиксировать в этом разделе.`,
    `Итог раздела: конкретные выводы и следующий шаг.`
  ].filter(Boolean) as string[];

  return lines.slice(0, lengthLines).join("\n\n");
}

export function generateDocumentStructure(params: {
  title: string;
  prompt: string;
  template?: DocumentTemplate;
  tone?: DocumentTone;
  structure?: DocumentStructure;
  length?: DocumentLength;
  sourceText?: string;
}) {
  const template = params.template || "report";
  const tone = params.tone || "neutral";
  const structure = params.structure || "standard";
  const length = params.length || "medium";
  const sourceExcerpt = params.sourceText?.slice(0, 260);
  const sections = getTemplateSections(template, structure).map((title) => ({
    key: slugify(title) || randomUUID(),
    title,
    content: generateDocumentSection({
      template,
      sectionTitle: title,
      prompt: params.prompt,
      tone,
      length,
      sourceExcerpt
    })
  }));

  return {
    format: "structured-markdown",
    template,
    tone,
    structure,
    length,
    prompt: params.prompt,
    sections,
    metadata: {
      generatedFromSource: Boolean(params.sourceText)
    }
  } satisfies DocumentSourceModel;
}

export function updateDocumentSection(source: DocumentSourceModel, sectionKey: string, content: string) {
  return {
    ...source,
    sections: source.sections.map((section) => (section.key === sectionKey ? { ...section, content } : section))
  } satisfies DocumentSourceModel;
}

function sourceToMarkdown(title: string, source: DocumentSourceModel) {
  return [
    `# ${title}`,
    "",
    ...source.sections.flatMap((section) => [`## ${section.title}`, section.content, ""])
  ].join("\n");
}

function summarizeSource(source: DocumentSourceModel) {
  return markdownToPlainText(sourceToMarkdown("document", source)).slice(0, 240);
}

export function documentToCanvas(title: string, source: DocumentSourceModel) {
  return sourceToMarkdown(title, source);
}

function buildPdfBuffer(title: string, text: string) {
  const lines = [title, "", ...text.split(/\r?\n/)]
    .flatMap((line) => {
      if (line.length <= 88) {
        return [line];
      }

      const chunks: string[] = [];
      for (let index = 0; index < line.length; index += 88) {
        chunks.push(line.slice(index, index + 88));
      }
      return chunks;
    })
    .slice(0, 42);

  const escapedLines = lines.map((line) => line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"));
  const streamText = [
    "BT",
    "/F1 12 Tf",
    "50 780 Td",
    ...escapedLines.map((line, index) => `${index === 0 ? "" : "0 -16 Td "}(${line}) Tj`).filter(Boolean),
    "ET"
  ].join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(streamText, "utf8")} >> stream\n${streamText}\nendstream endobj`
  ];

  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, "utf8"));
    body += `${object}\n`;
  }
  const xrefOffset = Buffer.byteLength(body, "utf8");
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body, "utf8");
}

async function buildDocxBuffer(title: string, markdown: string) {
  const zip = new JSZip();
  const textParagraphs = markdownToPlainText(markdown)
    .split(/\r?\n/)
    .filter(Boolean)
    .map(
      (line) =>
        `<w:p><w:r><w:t xml:space="preserve">${line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</w:t></w:r></w:p>`
    )
    .join("");

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`
  );
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
  );
  zip.folder("docProps")?.file(
    "core.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${title}</dc:title>
</cp:coreProperties>`
  );
  zip.folder("docProps")?.file(
    "app.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>ElbrusWay AI</Application>
</Properties>`
  );
  zip.folder("word")?.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${textParagraphs}<w:sectPr/></w:body>
</w:document>`
  );

  return zip.generateAsync({ type: "nodebuffer" });
}

async function buildPptxBuffer(title: string, markdown: string) {
  const zip = new JSZip();
  const sections = markdown
    .split(/\n##\s+/)
    .map((section, index) => (index === 0 ? section : `## ${section}`))
    .filter(Boolean)
    .slice(0, 6);

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${sections
    .map(
      (_, index) =>
        `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    )
    .join("\n")}
</Types>`
  );
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
  );
  zip.folder("ppt")?.folder("_rels")?.file(
    "presentation.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sections
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`
    )
    .join("\n")}
</Relationships>`
  );
  zip.folder("ppt")?.file(
    "presentation.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>${sections.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`).join("")}</p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
</p:presentation>`
  );

  sections.forEach((section, index) => {
    const text = markdownToPlainText(section).slice(0, 1400).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    zip.folder("ppt")?.folder("slides")?.file(
      `slide${index + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr/>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`
    );
  });

  return zip.generateAsync({ type: "nodebuffer" });
}

async function ensureExportsRoot() {
  await mkdir(exportsRoot, { recursive: true });
}

async function createExportArtifact(params: {
  documentId: string;
  userId: string;
  title: string;
  markdown: string;
  format: DocumentExportFormat;
}) {
  await ensureExportsRoot();
  const safeTitle = params.title.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "document";
  const filename = `${safeTitle}-${params.documentId}.${params.format.toLowerCase()}`;
  const storageKey = path.join("documents", filename);
  const absolutePath = path.join(exportsRoot, filename);
  let buffer: Buffer;

  switch (params.format) {
    case DocumentExportFormat.TXT:
      buffer = Buffer.from(markdownToPlainText(params.markdown), "utf8");
      break;
    case DocumentExportFormat.MD:
      buffer = Buffer.from(params.markdown, "utf8");
      break;
    case DocumentExportFormat.PDF:
      buffer = buildPdfBuffer(params.title, markdownToPlainText(params.markdown));
      break;
    case DocumentExportFormat.DOCX:
      buffer = await buildDocxBuffer(params.title, params.markdown);
      break;
    case DocumentExportFormat.PPTX:
      buffer = await buildPptxBuffer(params.title, params.markdown);
      break;
  }

  await writeFile(absolutePath, buffer);
  return {
    storageKey,
    fileSizeBytes: buffer.byteLength,
    absolutePath,
    filename
  };
}

function parseDocumentSource(source: Prisma.JsonValue | null | undefined) {
  const parsed = (source || null) as DocumentSourceModel | null;
  if (parsed?.format === "structured-markdown" && Array.isArray(parsed.sections)) {
    return parsed;
  }

  return generateDocumentStructure({
    title: "Документ",
    prompt: typeof (source as { content?: unknown } | null)?.content === "string" ? String((source as { content?: string }).content) : "",
    template: "report"
  });
}

export async function listDocumentsForUser(userId: string, projectId?: string) {
  return prisma.document.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(projectId
        ? {
            projectLinks: {
              some: { projectId }
            }
          }
        : {})
    },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 2
      },
      exports: {
        orderBy: { createdAt: "desc" }
      },
      projectLinks: {
        include: {
          project: {
            select: {
              id: true,
              title: true
            }
          }
        }
      }
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });
}

export async function getDocumentForUser(userId: string, documentId: string) {
  return prisma.document.findFirst({
    where: {
      id: documentId,
      userId,
      deletedAt: null
    },
    include: {
      versions: {
        orderBy: { version: "desc" }
      },
      exports: {
        orderBy: { createdAt: "desc" }
      },
      projectLinks: {
        include: {
          project: {
            select: {
              id: true,
              title: true
            }
          }
        }
      }
    }
  });
}

export async function createDocumentForUser(params: {
  userId: string;
  title: string;
  prompt: string;
  projectId?: string;
  sourceFileId?: string;
  sourceChatId?: string;
  template?: DocumentTemplate;
  tone?: DocumentTone;
  structure?: DocumentStructure;
  length?: DocumentLength;
}) {
  const sourceFile = params.sourceFileId ? await getFileForUser(params.userId, params.sourceFileId) : null;
  const sourceText = sourceFile?.extractedText || undefined;
  const source = generateDocumentStructure({
    title: params.title,
    prompt: params.prompt,
    template: params.template,
    tone: params.tone,
    structure: params.structure,
    length: params.length,
    sourceText
  });
  const markdown = sourceToMarkdown(params.title, source);

  const document = await prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        userId: params.userId,
        sourceFileId: params.sourceFileId || null,
        title: params.title,
        templateKey: source.template,
        status: DocumentStatus.READY,
        source: source as Prisma.InputJsonValue,
        summary: summarizeSource(source)
      }
    });

    await tx.documentVersion.create({
      data: {
        documentId: created.id,
        userId: params.userId,
        version: 1,
        title: params.title,
        source: source as Prisma.InputJsonValue,
        changeSummary: "Первичная генерация структуры"
      }
    });

    if (params.projectId) {
      await tx.projectDocumentLink.create({
        data: {
          projectId: params.projectId,
          documentId: created.id,
          userId: params.userId
        }
      });
    }

    const canvas = await tx.canvasDocument.create({
      data: {
        userId: params.userId,
        projectId: params.projectId || null,
        sourceChatId: params.sourceChatId || null,
        sourceFileId: params.sourceFileId || null,
        title: params.title,
        kind: "MARKDOWN",
        currentContent: markdown
      }
    });

    await tx.canvasVersion.create({
      data: {
        canvasId: canvas.id,
        userId: params.userId,
        version: 1,
        content: markdown,
        prompt: params.prompt
      }
    });

    return created;
  });

  return getDocumentForUser(params.userId, document.id);
}

export async function updateDocumentForUser(params: {
  userId: string;
  documentId: string;
  title?: string;
  content?: string;
  sectionKey?: string;
  changeSummary?: string;
  regenerateSummary?: boolean;
  archived?: boolean;
}) {
  const current = await prisma.document.findFirst({
    where: {
      id: params.documentId,
      userId: params.userId,
      deletedAt: null
    },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1
      }
    }
  });

  if (!current) {
    throw new Error("DOCUMENT_NOT_FOUND");
  }

  const currentSource = parseDocumentSource(current.source);
  let nextSource = currentSource;

  if (params.sectionKey && params.content !== undefined) {
    nextSource = updateDocumentSection(currentSource, params.sectionKey, params.content);
  } else if (params.content !== undefined) {
    nextSource = {
      ...currentSource,
      sections: currentSource.sections.length > 0
        ? [{ ...currentSource.sections[0], content: params.content }, ...currentSource.sections.slice(1)]
        : [{ key: "content", title: "Content", content: params.content }]
    };
  }

  const nextVersion = (current.versions[0]?.version || 0) + 1;
  const nextTitle = params.title || current.title;
  const nextStatus = params.archived ? DocumentStatus.ARCHIVED : current.status;
  const summary = params.regenerateSummary ? summarizeSource(nextSource) : current.summary || summarizeSource(nextSource);

  await prisma.$transaction(async (tx) => {
    await tx.document.update({
      where: { id: current.id },
      data: {
        title: nextTitle,
        source: nextSource as Prisma.InputJsonValue,
        summary,
        status: nextStatus,
        templateKey: nextSource.template,
        updatedAt: new Date()
      }
    });

    await tx.documentVersion.create({
      data: {
        documentId: current.id,
        userId: params.userId,
        version: nextVersion,
        title: nextTitle,
        source: nextSource as Prisma.InputJsonValue,
        changeSummary: params.changeSummary || (params.sectionKey ? `Обновлён раздел ${params.sectionKey}` : "Обновление документа")
      }
    });
  });

  return getDocumentForUser(params.userId, current.id);
}

export async function archiveDocumentForUser(userId: string, documentId: string) {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      userId,
      deletedAt: null
    }
  });

  if (!document) {
    throw new Error("DOCUMENT_NOT_FOUND");
  }

  await prisma.document.update({
    where: { id: document.id },
    data: {
      status: DocumentStatus.ARCHIVED
    }
  });

  return getDocumentForUser(userId, document.id);
}

export async function deleteDocumentForUser(userId: string, documentId: string) {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      userId,
      deletedAt: null
    }
  });

  if (!document) {
    throw new Error("DOCUMENT_NOT_FOUND");
  }

  await prisma.document.update({
    where: { id: document.id },
    data: {
      deletedAt: new Date(),
      status: DocumentStatus.DELETED
    }
  });

  return { id: document.id };
}

export async function exportDocumentForUser(params: {
  userId: string;
  documentId: string;
  format: DocumentExportFormat;
}) {
  const document = await getDocumentForUser(params.userId, params.documentId);

  if (!document) {
    throw new Error("DOCUMENT_NOT_FOUND");
  }

  const source = parseDocumentSource(document.source);
  const markdown = sourceToMarkdown(document.title, source);
  const artifact = await createExportArtifact({
    documentId: document.id,
    userId: params.userId,
    title: document.title,
    markdown,
    format: params.format
  });

  const exportRecord = await prisma.documentExport.create({
    data: {
      documentId: document.id,
      userId: params.userId,
      format: params.format,
      storageKey: artifact.storageKey,
      fileSizeBytes: artifact.fileSizeBytes
    }
  });

  return {
    exportRecord,
    absolutePath: artifact.absolutePath,
    filename: artifact.filename,
    markdown
  };
}
