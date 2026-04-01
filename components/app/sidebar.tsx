"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type SidebarItem = {
  href: string;
  label: string;
  icon: string;
  requiresAdmin?: boolean;
};

const primaryItems: SidebarItem[] = [
  { href: "/chat", label: "Чат", icon: "●" },
  { href: "/projects", label: "Проекты", icon: "▣" },
  { href: "/files", label: "Файлы", icon: "◫" },
  { href: "/documents", label: "Документы", icon: "✦" },
  { href: "/canvas", label: "Канвас", icon: "◇" },
  { href: "/rates", label: "Тарифы", icon: "₽" },
  { href: "/profile", label: "Профиль", icon: "◉" },
  { href: "/settings", label: "Настройки", icon: "⋯" },
  { href: "/admin", label: "Админка", icon: "⚙", requiresAdmin: true }
];

const toolItems: SidebarItem[] = [
  { href: "/tools/vision", label: "Зрение", icon: "◌" },
  { href: "/tools/search", label: "Поиск", icon: "⌕" },
  { href: "/tools/documents", label: "Документы", icon: "✎" },
  { href: "/tools/image", label: "Изображения", icon: "◐" },
  { href: "/tools/video", label: "Видео", icon: "▷" },
  { href: "/tools/audio", label: "Аудио", icon: "◍" }
];

function ItemLink({ item, pathname }: { item: SidebarItem; pathname: string }) {
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      className="sidebar-link"
      style={{
        background: active ? "rgba(30,111,217,0.18)" : undefined,
        borderColor: active ? "rgba(30,111,217,0.35)" : undefined
      }}
    >
      <span className="badge" style={{ minWidth: 34, justifyContent: "center" }}>{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <aside className="sidebar panel">
      <div>
        <div className="sidebar-title">Рабочее пространство</div>
        <div className="sidebar-group">
          {primaryItems.filter((item) => !item.requiresAdmin || isAdmin).map((item) => <ItemLink key={item.href} item={item} pathname={pathname} />)}
        </div>
      </div>
      <div>
        <div className="sidebar-title">Инструменты</div>
        <div className="sidebar-group">
          {toolItems.map((item) => <ItemLink key={item.href} item={item} pathname={pathname} />)}
        </div>
      </div>
      <button type="button" className="button-ghost" onClick={() => void logout()} disabled={loading}>
        {loading ? "Выход..." : "Выйти"}
      </button>
    </aside>
  );
}
