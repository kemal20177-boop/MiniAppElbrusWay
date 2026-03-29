const http = require("http");

const port = Number(process.env.PORT || 3000);
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://elbrusway.ru";
const appName = process.env.NEXT_PUBLIC_APP_NAME || "ElbrusWay AI";

const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${appName}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      background:
        radial-gradient(circle at top left, rgba(228, 181, 82, 0.28), transparent 30%),
        radial-gradient(circle at right, rgba(60, 116, 181, 0.22), transparent 35%),
        linear-gradient(135deg, #f6efe3 0%, #eef4fa 100%);
      color: #1b2430;
    }
    .wrap {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 32px;
    }
    .card {
      width: min(820px, 100%);
      background: rgba(255, 255, 255, 0.86);
      border: 1px solid rgba(27, 36, 48, 0.08);
      border-radius: 28px;
      padding: 40px;
      box-shadow: 0 24px 80px rgba(27, 36, 48, 0.12);
      backdrop-filter: blur(12px);
    }
    .eyebrow {
      display: inline-block;
      margin-bottom: 18px;
      padding: 8px 12px;
      border-radius: 999px;
      background: #1b2430;
      color: #fff;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0 0 16px;
      font-size: clamp(38px, 8vw, 72px);
      line-height: 0.96;
    }
    p {
      margin: 0;
      max-width: 54ch;
      font-size: 18px;
      line-height: 1.65;
      color: #415063;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      margin-top: 28px;
    }
    .item {
      padding: 16px 18px;
      border-radius: 18px;
      background: #f8fafc;
      border: 1px solid rgba(27, 36, 48, 0.08);
    }
    .label {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
    }
    .value {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      word-break: break-word;
    }
    a {
      color: #0f4c81;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <main class="card">
      <span class="eyebrow">Production Bootstrap</span>
      <h1>${appName}</h1>
      <p>Сайт уже поднят на домене, HTTPS работает, и базовый runtime отвечает на порту 3000. Следующий этап: заменить этот bootstrap на полноценное приложение с auth, chat и Platega billing flow.</p>
      <section class="grid">
        <div class="item">
          <span class="label">Domain</span>
          <div class="value"><a href="${appUrl}">${appUrl}</a></div>
        </div>
        <div class="item">
          <span class="label">Health</span>
          <div class="value"><a href="/healthz">/healthz</a></div>
        </div>
        <div class="item">
          <span class="label">Payments</span>
          <div class="value">Platega ready</div>
        </div>
      </section>
    </main>
  </div>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, service: "elbrusway-bootstrap", port }));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`ElbrusWay bootstrap server listening on http://127.0.0.1:${port}`);
});
