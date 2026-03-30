export function Footer() {
  return (
    <footer className="shell" style={{ padding: "0 0 48px" }}>
      <div
        className="panel"
        style={{
          padding: 24,
          display: "flex",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap"
        }}
      >
        <div>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>ElbrusWay AI</div>
          <div className="muted">Платформа доступа к RouterAI и ведущим моделям для РФ и СНГ.</div>
        </div>
        <div className="muted">elbrusway.ru · ИНН / ОГРН / оферта добавляются перед релизом</div>
      </div>
    </footer>
  );
}
