"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AppIcon } from "@/components/app/icon";

type SidebarItem = {
  href?: string;
  label: string;
  icon: Parameters<typeof AppIcon>[0]["name"];
  action?: "logout";
};

const groups: Array<{ title: string; items: SidebarItem[] }> = [
  {
    title: "Работа",
    items: [
      { href: "/chat?new=1", label: "Новый чат", icon: "plus" },
      { href: "/chat", label: "Чат", icon: "chat" },
      { href: "/projects", label: "Проекты", icon: "folder" },
      { href: "/files", label: "Файлы", icon: "file" }
    ]
  },
  {
    title: "Инструменты",
    items: [
      { href: "/tools/image", label: "Изображения", icon: "image" },
      { href: "/tools/video", label: "Видео", icon: "video" },
      { href: "/tools/audio", label: "Аудио", icon: "audio" },
      { href: "/documents", label: "Документы", icon: "doc" },
      { href: "/canvas", label: "Canvas", icon: "edit" }
    ]
  },
  {
    title: "Аккаунт",
    items: [
      { href: "/rates", label: "Тарифы", icon: "coin" },
      { href: "/profile", label: "Аккаунт", icon: "user" },
      { href: "/settings", label: "Настройки", icon: "settings" },
      { label: "Выйти", icon: "logout", action: "logout" }
    ]
  }
];

function SidebarLink({
  item,
  pathname,
  onAction
}: {
  item: SidebarItem;
  pathname: string;
  onAction: (action: NonNullable<SidebarItem["action"]>) => void;
}) {
  if (item.action) {
    return (
      <button type="button" className="nav-link" onClick={() => onAction(item.action!)}>
        <span className="nav-link-icon">
          <AppIcon name={item.icon} size={18} />
        </span>
        <span>{item.label}</span>
      </button>
    );
  }

  const active = item.href
    ? pathname === item.href || pathname.startsWith(`${item.href}/`) || pathname.startsWith(item.href.split("?")[0] || "")
    : false;

  return (
    <Link href={item.href || "#"} className={active ? "nav-link nav-link-active" : "nav-link"}>
      <span className="nav-link-icon">
        <AppIcon name={item.icon} size={18} />
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAction(action: "logout") {
    if (action !== "logout") {
      return;
    }
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <>
      <div className={isOpen ? "sidebar-backdrop visible" : "sidebar-backdrop"} onClick={onClose} />
      <aside className={isOpen ? "sidebar-frame open" : "sidebar-frame"}>
        <div className="sidebar-brand">
          <Link href="/" className="brand-lockup" onClick={onClose}>
            <span className="brand-mark">E</span>
            <span>
              <strong>ElbrusWay AI</strong>
              <small>Спокойный AI workspace</small>
            </span>
          </Link>
          <button type="button" className="icon-button sidebar-close" onClick={onClose}>
            <AppIcon name="close" size={18} />
          </button>
        </div>

        <nav className="sidebar-groups">
          {groups.map((group) => (
            <section key={group.title}>
              <div className="sidebar-section-title">{group.title}</div>
              <div className="sidebar-links">
                {group.items.map((item) => (
                  <SidebarLink key={item.label} item={item} pathname={pathname} onAction={handleAction} />
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="sidebar-footer">{loading ? "Выходим..." : "Главное действие всегда начинается с чата или нужного инструмента."}</div>
      </aside>
    </>
  );
}
