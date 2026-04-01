import { WorkspacePlaceholder } from "@/components/app/workspace-placeholder";

export default function SettingsPage() {
  return (
    <WorkspacePlaceholder
      badge="Settings"
      title="Настройки пользователя"
      description="Этот раздел уже выделен под email verification, password reset, OAuth, device sessions и персональные предпочтения рабочего пространства."
      actions={[
        { href: "/profile", label: "Профиль", primary: true },
        { href: "/rates", label: "Тарифы" }
      ]}
    />
  );
}
