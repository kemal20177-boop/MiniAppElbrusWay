export function Footer() {
  return (
    <footer className="footer">
      <div className="surface" style={{ padding: "18px 20px" }}>
        <div className="toolbar-row" style={{ justifyContent: "space-between" }}>
          <div className="feature-row">
            <strong>ElbrusWay AI</strong>
            <span>Понятный сервис для чата, изображений, видео, аудио, документов и файлов.</span>
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
