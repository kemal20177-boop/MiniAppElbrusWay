export function Footer() {
  return (
    <footer className="shell" style={{ padding: "0 0 48px" }}>
      <div
        className="panel"
        style={{
          padding: "22px 24px",
          display: "flex",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap"
        }}
      >
        <div>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>ElbrusWay AI</div>
          <div className="muted">Чат, документы, изображения, поиск и файлы в одном аккуратном сервисе.</div>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <a className="muted" href="/rates">Тарифы</a>
          <a className="muted" href="/profile">Аккаунт</a>
          <a className="muted" href="/chat">Чат</a>
        </div>
      </div>
    </footer>
  );
}
