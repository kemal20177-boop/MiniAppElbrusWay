import "server-only";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { DocumentExportFormat, DocumentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const exportsRoot = path.join(process.cwd(), "storage", "exports");

function markdownToPlainText(markdown: string) {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1 ($2)")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .trim();
}

function buildDocumentMarkdown(title: string, prompt: string) {
  const cleanPrompt = prompt.trim();
  return `# ${title}

## Цель
${cleanPrompt}

## Краткое резюме
- Ключевая задача: ${cleanPrompt}
- Формат: production-ready материал для дальнейшего редактирования в Canvas
- Следующий шаг: доработать разделы и экспортировать результат

## Основные разделы
### Контекст
Опиши исходные вводные, ограничения и ожидаемый результат.

### Решение
Сформулируй основной подход, архитектуру или план действий.

### Детали реализации
- Какие сущности или процессы участвуют
- Какие риски и trade-offs нужно учитывать
- Какие метрики или критерии проверки будут использоваться

### Следующие шаги
1. Уточнить требования и источники.
2. Доработать содержание в Canvas.
3. Выполнить экспорт в нужный формат.
`;
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
  const filename = `${params.documentId}-${randomUUID()}-${safeTitle}.${params.format.toLowerCase()}`;
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
    absolutePath
  };
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
        take: 1
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
}) {
  const markdown = buildDocumentMarkdown(params.title, params.prompt);
  const source = {
    format: "markdown",
    content: markdown
  };

  const document = await prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        userId: params.userId,
        sourceFileId: params.sourceFileId || null,
        title: params.title,
        status: DocumentStatus.READY,
        source,
        summary: params.prompt.slice(0, 240)
      }
    });

    await tx.documentVersion.create({
      data: {
        documentId: created.id,
        userId: params.userId,
        version: 1,
        title: params.title,
        source
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
  content: string;
  changeSummary?: string;
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

  const nextVersion = (current.versions[0]?.version || 0) + 1;
  const nextTitle = params.title || current.title;
  const source = {
    format: "markdown",
    content: params.content
  };

  await prisma.$transaction(async (tx) => {
    await tx.document.update({
      where: { id: current.id },
      data: {
        title: nextTitle,
        source,
        summary: markdownToPlainText(params.content).slice(0, 240),
        updatedAt: new Date()
      }
    });

    await tx.documentVersion.create({
      data: {
        documentId: current.id,
        userId: params.userId,
        version: nextVersion,
        title: nextTitle,
        source,
        changeSummary: params.changeSummary || null
      }
    });
  });

  return getDocumentForUser(params.userId, current.id);
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

  const source = (document.source || {}) as { content?: string };
  const markdown = String(source.content || "");
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
    absolutePath: artifact.absolutePath
  };
}
