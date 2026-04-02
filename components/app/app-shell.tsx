"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Footer } from "@/components/ui/footer";
import { Sidebar } from "@/components/app/sidebar";
import { AppIcon } from "@/components/app/icon";

type ShellUser = {
  name?: string | null;
  email: string;
  role: string;
};

function isAuthRoute(pathname: string) {
  return pathname.startsWith("/auth/");
}

export function AppShell({ children, user }: { children: ReactNode; user: ShellUser | null }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const authScreen = isAuthRoute(pathname);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (authScreen) {
    return <div className="auth-root">{children}</div>;
  }

  return (
    <div className="app-frame">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="icon-button" onClick={() => setSidebarOpen(true)}>
              <AppIcon name="menu" size={18} />
            </button>
            <Link href="/" className="brand-inline">
              <span className="brand-mark small">E</span>
              <span className="brand-inline-copy">
                <strong>ElbrusWay AI</strong>
                <small>Чат, медиа, документы и файлы</small>
              </span>
            </Link>
          </div>
          <div className="topbar-right">
            <Link href="/chat?new=1" className="button-ghost compact-button">
              Новый чат
            </Link>
            {user ? (
              <Link href="/profile" className="account-pill">
                <span className="account-title">{user.name || user.email}</span>
                <span className="account-copy">Аккаунт</span>
              </Link>
            ) : (
              <div className="topbar-actions">
                <Link href="/auth/login" className="button-ghost compact-button">
                  Войти
                </Link>
                <Link href="/auth/register" className="button-primary compact-button">
                  Начать
                </Link>
              </div>
            )}
          </div>
        </header>

        <main className="page-shell">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
