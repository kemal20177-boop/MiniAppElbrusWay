import Link from "next/link";
import { siteConfig } from "@/lib/site";

const links = [
  { href: "/", label: "Главная" },
  { href: "/chat", label: "Чат" },
  { href: "/rates", label: "Тарифы" },
  { href: "/profile", label: "Кабинет" },
  { href: "/admin", label: "Админ" }
];

export function Header() {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 20, backdropFilter: "blur(16px)" }}>
      <div className="shell" style={{ padding: "18px 0" }}>
        <div
          className="panel"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px"
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                background: "linear-gradient(160deg, #1e6fd9, #00c8e8)",
                display: "grid",
                placeItems: "center",
                fontWeight: 900
              }}
            >
              E
            </div>
            <div>
              <div style={{ fontWeight: 800 }}>{siteConfig.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Все нейросети без барьеров
              </div>
            </div>
          </Link>
          <nav style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="muted">
                {link.label}
              </Link>
            ))}
            <Link href="/auth/login" className="button-ghost">
              Войти
            </Link>
            <Link href="/auth/register" className="button-primary">
              Попробовать
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
