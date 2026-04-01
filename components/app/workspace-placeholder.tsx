import Link from "next/link";

export function WorkspacePlaceholder({
  badge,
  title,
  description,
  actions
}: {
  badge: string;
  title: string;
  description: string;
  actions?: Array<{ href: string; label: string; primary?: boolean }>;
}) {
  return (
    <main className="workspace-page">
      <section className="panel workspace-panel">
        <div className="badge">{badge}</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>{title}</h1>
        <p className="section-copy" style={{ maxWidth: 760 }}>{description}</p>
        {actions?.length ? (
          <div className="workspace-actions">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={action.primary ? "button-primary" : "button-secondary"}
              >
                {action.label}
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
