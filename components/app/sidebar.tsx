"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type NavItem = {
  href?: string;
  icon: string;
  label: string;
  section: "main" | "workspace" | "account";
  action?: "logout";
};

const navItems: NavItem[] = [
  { href: "/chat", icon: "💬", label: "Чат", section: "main" },
  { href: "/tools/image", icon: "🖼", label: "Изображения", section: "main" },
  { href: "/tools/video", icon: "🎬", label: "Видео", section: "main" },
  { href: "/tools/audio", icon: "🎵", label: "Аудио", section: "main" },
  { href: "/tools/vision", icon: "👁", label: "Vision", section: "main" },
  { href: "/projects", icon: "📁", label: "Проекты", section: "workspace" },
  { href: "/files", icon: "📄", label: "Файлы", section: "workspace" },
  { href: "/documents", icon: "📝", label: "Документы", section: "workspace" },
  { href: "/canvas", icon: "✏️", label: "Canvas", section: "workspace" },
  { href: "/rates", icon: "💳", label: "Тарифы", section: "account" },
  { href: "/profile", icon: "👤", label: "Профиль", section: "account" },
  { icon: "↩", label: "Выйти", section: "account", action: "logout" }
];

const mobileItems = navItems.filter((item) => ["/chat", "/tools/image", "/tools/video", "/files", "/profile"].includes(item.href || ""));

function isActivePath(pathname: string, href?: string) {
  if (!href) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavEntry({
  item,
  pathname,
  onAction,
  className
}: {
  item: NavItem;
  pathname: string;
  onAction: (action: NonNullable<NavItem["action"]>) => void;
  className: string;
}) {
  const active = isActivePath(pathname, item.href);

  if (item.action) {
    return (
      <button type="button" className={className} onClick={() => onAction(item.action!)}>
        <span className="nav-item-icon">{item.icon}</span>
        <span>{item.label}</span>
      </button>
    );
  }

  return (
    <Link href={item.href || "#"} className={active ? `${className} active` : className}>
      <span className="nav-item-icon">{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}

export function Sidebar({
  isOpen,
  onClose,
  showRail
}: {
  isOpen: boolean;
  onClose: () => void;
  showRail: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAction(action: "logout") {
    if (action !== "logout") return;
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <>
      {showRail ? (
        <aside className="nav-rail">
          <div className="nav-section-label">Main</div>
          {navItems.filter((item) => item.section === "main").map((item) => (
            <NavEntry key={`${item.section}-${item.label}`} item={item} pathname={pathname} onAction={handleAction} className="nav-item" />
          ))}

          <div className="nav-section-label">Workspace</div>
          {navItems.filter((item) => item.section === "workspace").map((item) => (
            <NavEntry key={`${item.section}-${item.label}`} item={item} pathname={pathname} onAction={handleAction} className="nav-item" />
          ))}

          <div className="nav-section-label">Account</div>
          {navItems.filter((item) => item.section === "account").map((item) => (
            <NavEntry key={`${item.section}-${item.label}`} item={item} pathname={pathname} onAction={handleAction} className="nav-item" />
          ))}

          <div className="muted-text" style={{ marginTop: "auto", padding: "12px 12px 0" }}>
            {loading ? "Выходим..." : "Быстрый доступ к чату, медиа и рабочим разделам."}
          </div>
        </aside>
      ) : null}

      <div className={isOpen ? "sidebar-backdrop visible" : "sidebar-backdrop"} onClick={onClose} />
      <aside className={isOpen ? "sidebar-frame open" : "sidebar-frame"}>
        <div className="sidebar-brand">
          <Link href="/" className="brand-lockup" onClick={onClose}>
            <span className="brand-mark">E</span>
            <span>
              <strong>ElbrusWay AI</strong>
              <small>AI без барьеров</small>
            </span>
          </Link>
          <button type="button" className="icon-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="section-stack">
          {(["main", "workspace", "account"] as const).map((section) => (
            <div key={section}>
              <div className="nav-section-label">{section}</div>
              <div className="section-stack" style={{ gap: 4 }}>
                {navItems
                  .filter((item) => item.section === section)
                  .map((item) => (
                    <NavEntry
                      key={`drawer-${section}-${item.label}`}
                      item={item}
                      pathname={pathname}
                      onAction={handleAction}
                      className="nav-item"
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {showRail ? (
        <nav className="mobile-bottom-nav" aria-label="Основная навигация">
          {mobileItems.map((item) => (
            <NavEntry key={`mobile-${item.label}`} item={item} pathname={pathname} onAction={handleAction} className="mobile-nav-item" />
          ))}
        </nav>
      ) : null}
    </>
  );
}
