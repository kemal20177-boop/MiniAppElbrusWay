#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [
  "app/api/chat/stream/route.ts",
  "app/api/files/route.ts",
  "app/api/search/route.ts",
  "app/api/documents/route.ts",
  "app/api/tools/image/route.ts",
  "app/api/tools/audio/route.ts",
  "app/api/tools/video/route.ts",
  "app/api/tools/vision/route.ts",
  "app/chat/page.tsx",
  "app/files/page.tsx",
  "app/documents/page.tsx",
  "app/admin/page.tsx",
  "app/api/admin/jobs/route.ts",
  "app/api/admin/search-sessions/route.ts",
  "app/api/admin/audit/route.ts",
  "lib/providers/shared.ts",
  "tests/search-utils.test.ts",
  "tests/tool-job-utils.test.ts"
];

let failed = false;
for (const rel of checks) {
  const absolute = path.join(root, rel);
  if (!fs.existsSync(absolute)) {
    console.error(`MISSING ${rel}`);
    failed = true;
  } else {
    console.log(`OK ${rel}`);
  }
}

if (failed) {
  process.exit(1);
}

const contentChecks = [
  ["README.md", "RouterAI layer в `lib/routerai/*`"],
  ["app/tools/image/page.tsx", "История"],
  ["app/chat/page.tsx", "Open full canvas"],
  ["app/admin/page.tsx", "Задания инструментов"]
];

for (const [rel, needle] of contentChecks) {
  const absolute = path.join(root, rel);
  const text = fs.readFileSync(absolute, "utf8");
  if (!text.includes(needle)) {
    console.error(`MISSING_CONTENT ${rel} -> ${needle}`);
    failed = true;
  } else {
    console.log(`OK_CONTENT ${rel}`);
  }
}

if (failed) {
  process.exit(1);
}
