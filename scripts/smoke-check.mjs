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
  "app/admin/page.tsx"
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
