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
  plan: string;
  tokenBalance: number;
};

function isAuthRoute(pathname: string) {
  return pathname.startsWith("/auth/");
}

function usesWorkspaceNav(pathname: string) {
  return [
    "/chat",
    "/tools/",
    "/projects",
    "/files",
    "/documents",
    "/canvas",
    "/rates",
    "/profile"
  ].some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

export function AppShell({ children, user }: { children: ReactNode; user: ShellUser | null }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const authScreen = isAuthRoute(pathname);
  const compactBrand = pathname === "/chat" || pathname.startsWith("/tools/");
  const showRail = usesWorkspaceNav(pathname);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (authScreen) {
    return <div className="auth-root">{children}</div>;
  }

  return (
    <div className="app-frame">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} showRail={showRail} />
      <header className="topbar">
        <div className="topbar-left">
          <button type="button" className={showRail ? "icon-button rail-toggle" : "icon-button"} onClick={() => setSidebarOpen(true)}>
            <AppIcon name="menu" size={18} />
          </button>
          <Link href="/" className="brand-inline">
            <span className="brand-mark small">E</span>
            <span className="brand-inline-copy">
              <strong>ElbrusWay AI</strong>
              <small>{compactBrand ? "Сначала сообщение, потом всё остальное" : "Понятный AI workspace без лишнего шума"}</small>
            </span>
          </Link>
        </div>
        <div className="topbar-right">
          <Link href="/chat?new=1" className="button-ghost compact-button">
            Новый чат
          </Link>
          {user ? (
            <>
              <Link href="/rates" className="button-secondary compact-button">
                Пополнить
              </Link>
              <div className="balance-widget">
                <strong>{(user.tokenBalance / 1_000_000).toFixed(1)}M</strong>
                <span>токенов</span>
                <span className="plan-pill">{user.plan || "Free"}</span>
              </div>
              <Link href="/profile" className="account-pill">
                <span className="account-title">{user.name || user.email}</span>
                <span className="account-sub">{user.role === "ADMIN" ? "Админ" : "Аккаунт"}</span>
              </Link>
            </>
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

      <div className="app-shell-row">
        <div className="app-main">
          <main className="page-shell">{children}</main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
