"use client";

import type { CSSProperties } from "react";

export type IconName =
  | "spark"
  | "chat"
  | "folder"
  | "file"
  | "doc"
  | "edit"
  | "image"
  | "image-edit"
  | "video"
  | "audio"
  | "vision"
  | "coin"
  | "user"
  | "settings"
  | "logout"
  | "grid"
  | "menu"
  | "close"
  | "panel"
  | "plus";

const paths: Record<IconName, string[]> = {
  spark: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"],
  chat: ["M5 6.5A2.5 2.5 0 017.5 4h9A2.5 2.5 0 0119 6.5v6A2.5 2.5 0 0116.5 15H11l-4 4v-4H7.5A2.5 2.5 0 015 12.5v-6z"],
  folder: ["M3.5 8A2.5 2.5 0 016 5.5h4l1.4 1.5H18A2.5 2.5 0 0120.5 9.5v7A2.5 2.5 0 0118 19H6A2.5 2.5 0 013.5 16.5V8z"],
  file: ["M7 3.5h6l4 4V18A2 2 0 0115 20H7A2 2 0 015 18V5.5A2 2 0 017 3.5z", "M13 3.5V8h4.5"],
  doc: ["M7 4.5h10A1.5 1.5 0 0118.5 6v12A1.5 1.5 0 0117 19.5H7A1.5 1.5 0 015.5 18V6A1.5 1.5 0 017 4.5z", "M8.5 9.5h7", "M8.5 13h7", "M8.5 16.5h4.5"],
  edit: ["M4 17.5V20h2.5L17.6 8.9l-2.5-2.5L4 17.5z", "M13.7 4.7l2.6 2.6"],
  image: ["M4.5 6A2.5 2.5 0 017 3.5h10A2.5 2.5 0 0119.5 6v12A2.5 2.5 0 0117 20.5H7A2.5 2.5 0 014.5 18V6z", "M8 15l2.8-3 2.2 2.4 3.5-4L19 14.5", "M9 9.25A1.25 1.25 0 109 6.75a1.25 1.25 0 000 2.5z"],
  "image-edit": ["M4.5 6A2.5 2.5 0 017 3.5h10A2.5 2.5 0 0119.5 6v12A2.5 2.5 0 0117 20.5H7A2.5 2.5 0 014.5 18V6z", "M8 15l2.8-3 2.2 2.4 3.5-4L19 14.5", "M15 5l4 4", "M14 10l5-5"],
  video: ["M4.5 7A2.5 2.5 0 017 4.5h7A2.5 2.5 0 0116.5 7v10A2.5 2.5 0 0114 19.5H7A2.5 2.5 0 014.5 17V7z", "M16.5 10.5l4-2v7l-4-2v-3z"],
  audio: ["M12 4.5a3 3 0 013 3v4a3 3 0 11-6 0v-4a3 3 0 013-3z", "M6.5 11.5a5.5 5.5 0 0011 0", "M12 17v3.5", "M9 20.5h6"],
  vision: ["M2.5 12s3.5-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.5 5.5-9.5 5.5S2.5 12 2.5 12z", "M12 15.25A3.25 3.25 0 1012 8.75a3.25 3.25 0 000 6.5z"],
  coin: ["M12 4.5c4.7 0 8.5 1.8 8.5 4S16.7 12.5 12 12.5 3.5 10.7 3.5 8.5 7.3 4.5 12 4.5z", "M3.5 8.5v7c0 2.2 3.8 4 8.5 4s8.5-1.8 8.5-4v-7"],
  user: ["M12 12a4 4 0 100-8 4 4 0 000 8z", "M5 19a7 7 0 0114 0"],
  settings: ["M12 8.5A3.5 3.5 0 1012 15.5 3.5 3.5 0 0012 8.5z", "M12 3.5v2", "M12 18.5v2", "M20.5 12h-2", "M5.5 12h-2", "M18 6l-1.5 1.5", "M7.5 16.5L6 18", "M18 18l-1.5-1.5", "M7.5 7.5L6 6"],
  logout: ["M10 5.5H7A2.5 2.5 0 004.5 8v8A2.5 2.5 0 007 18.5h3", "M13 8.5l3.5 3.5L13 15.5", "M8.5 12h8"],
  grid: ["M4.5 4.5h6v6h-6z", "M13.5 4.5h6v6h-6z", "M4.5 13.5h6v6h-6z", "M13.5 13.5h6v6h-6z"],
  menu: ["M4 7h16", "M4 12h16", "M4 17h16"],
  close: ["M6 6l12 12", "M18 6L6 18"],
  panel: ["M4.5 5.5h15v13h-15z", "M9 5.5v13"],
  plus: ["M12 5v14", "M5 12h14"]
};

export function AppIcon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: size, height: size, ...style }}
    >
      {paths[name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}
