import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "@/components/app/app-shell";
import { getCurrentUserFromCookies } from "@/lib/auth";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url)
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUserFromCookies();

  return (
    <html lang="ru">
      <body suppressHydrationWarning>
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}
