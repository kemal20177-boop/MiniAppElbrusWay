import Link from "next/link";

type SidebarItem = {
  href: string;
  label: string;
  requiresAdmin?: boolean;
};

const primaryItems: SidebarItem[] = [
  { href: "/chat", label: "Новый чат" },
  { href: "/projects", label: "Проекты" },
  { href: "/files", label: "Файлы" },
  { href: "/documents", label: "Документы" },
  { href: "/canvas", label: "Canvas" },
  { href: "/rates", label: "Тарифы" },
  { href: "/profile", label: "Профиль" },
  { href: "/settings", label: "Настройки" },
  { href: "/admin", label: "Админка", requiresAdmin: true }
];

const toolItems: SidebarItem[] = [
  { href: "/tools/vision", label: "Vision" },
  { href: "/tools/search", label: "Web Search" },
  { href: "/tools/documents", label: "Documents" },
  { href: "/tools/image", label: "Image" },
  { href: "/tools/video", label: "Video" },
  { href: "/tools/audio", label: "Audio" }
];

function renderItems(items: SidebarItem[], isAdmin: boolean) {
  return items
    .filter((item) => !item.requiresAdmin || isAdmin)
    .map((item) => (
      <Link key={item.href} href={item.href} className="sidebar-link">
        {item.label}
      </Link>
    ));
}

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  return (
    <aside className="sidebar panel">
      <div>
        <div className="sidebar-title">Workspace</div>
        <div className="sidebar-group">
          {renderItems(primaryItems, isAdmin)}
        </div>
      </div>
      <div>
        <div className="sidebar-title">Инструменты</div>
        <div className="sidebar-group">
          {renderItems(toolItems, isAdmin)}
        </div>
      </div>
    </aside>
  );
}
