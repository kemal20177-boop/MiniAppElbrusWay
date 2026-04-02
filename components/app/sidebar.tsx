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
    title: "Основное",
    items: [
      { href: "/chat?new=1", label: "Новый чат", icon: "plus" },
      { href: "/chat", label: "Чат", icon: "chat" },
      { href: "/projects", label: "Проекты", icon: "folder" },
      { href: "/files", label: "Файлы", icon: "file" },
      { href: "/documents", label: "Документы", icon: "doc" },
      { href: "/canvas", label: "Редактор", icon: "edit" }
    ]
  },
  {
    title: "Нейросети",
    items: [
      { href: "/chat?family=auto", label: "Авто", icon: "spark" },
      { href: "/chat?family=chatgpt", label: "ChatGPT", icon: "chat" },
      { href: "/chat?family=claude", label: "Claude", icon: "doc" },
      { href: "/chat?family=gemini", label: "Gemini", icon: "grid" },
      { href: "/chat?family=grok", label: "Grok", icon: "spark" }
    ]
  },
  {
    title: "Медиа",
    items: [
      { href: "/tools/image", label: "Создать изображение", icon: "image" },
      { href: "/tools/image?mode=image-to-image", label: "Редактировать изображение", icon: "image-edit" },
      { href: "/tools/video", label: "Видео", icon: "video" },
      { href: "/tools/audio", label: "Аудио", icon: "audio" },
      { href: "/tools/vision", label: "Анализ изображений", icon: "vision" }
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
  const active = item.href ? pathname === item.href || pathname.startsWith(`${item.href}/`) : false;

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
              <small>Понятный AI-сервис</small>
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

        <div className="sidebar-footer">{loading ? "Выходим..." : "Все материалы доступны в одном кабинете."}</div>
      </aside>
    </>
  );
}
