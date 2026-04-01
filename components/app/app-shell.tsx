import Link from "next/link";
import type { ReactNode } from "react";
import { Footer } from "@/components/ui/footer";
import { Sidebar } from "@/components/app/sidebar";
import { siteConfig } from "@/lib/site";

type ShellUser = {
  name?: string | null;
  email: string;
  role: string;
};

export function AppShell({ children, user }: { children: ReactNode; user: ShellUser | null }) {
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="shell topbar-inner panel">
          <Link href="/" className="brand">
            <div className="brand-mark">E</div>
            <div>
              <div className="brand-title">{siteConfig.name}</div>
              <div className="muted brand-copy">Премиальный доступ к нейросетям в одном кабинете</div>
            </div>
          </Link>
          <nav className="topbar-nav">
            <Link href="/chat" className="muted">
              Чат
            </Link>
            <Link href="/projects" className="muted">
              Проекты
            </Link>
            <Link href="/rates" className="muted">
              Тарифы
            </Link>
            <Link href="/tools/image" className="muted">
              Изображения
            </Link>
            {user ? (
              <>
                <div className="topbar-user">
                  <div style={{ fontWeight: 700 }}>{user.name || user.email}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{user.role === "ADMIN" ? "Администратор" : "Аккаунт"}</div>
                </div>
                <Link href="/profile" className="button-secondary">
                  Аккаунт
                </Link>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="button-ghost">
                  Войти
                </Link>
                <Link href="/auth/register" className="button-primary">
                  Попробовать
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <div className="shell app-shell-body">
        <Sidebar isAdmin={isAdmin} />
        <div className="app-content">
          {children}
          <Footer />
        </div>
      </div>
    </div>
  );
}
