export function Footer() {
  return (
    <footer className="footer">
      <div className="surface footer-surface" style={{ padding: "18px 20px" }}>
        <div className="toolbar-row" style={{ justifyContent: "space-between" }}>
          <div className="feature-row">
            <strong>ElbrusWay AI</strong>
            <span>Понятный AI workspace для чата, изображений, аудио, документов, файлов и video planning.</span>
          </div>
          <div className="toolbar-row">
            <a href="/chat">Чат</a>
            <a href="/rates">Тарифы</a>
            <a href="/profile">Аккаунт</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
