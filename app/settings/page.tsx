import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="page-stack">
      <section className="surface">
        <div className="eyebrow">Настройки</div>
        <h1 className="surface-title">Раздел настроек уже подготовлен под персональные параметры аккаунта.</h1>
        <p className="surface-copy">Следующим этапом здесь можно разместить уведомления, устройства, смену пароля и личные предпочтения интерфейса.</p>
        <div className="toolbar-row" style={{ marginTop: 18 }}>
          <Link href="/profile" className="button-primary">
            Профиль
          </Link>
          <Link href="/rates" className="button-secondary">
            Тарифы
          </Link>
        </div>
      </section>
    </div>
  );
}
