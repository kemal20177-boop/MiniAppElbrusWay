import Link from "next/link";
import { planCatalog } from "@/lib/site";
import { getModels } from "@/lib/app";

export default async function HomePage() {
  const models = await getModels();
  const featuredModels = models.slice(0, 12);

  return (
    <main className="shell" style={{ padding: "18px 0 56px" }}>
      <section
        className="panel"
        style={{
          padding: "56px 28px",
          overflow: "hidden",
          position: "relative",
          marginBottom: 28
        }}
      >
        <div className="badge">RouterAI · ЮKassa · Российский AI Hub</div>
        <div style={{ maxWidth: 760, paddingTop: 20 }}>
          <h1 className="section-title">Все нейросети без VPN. Один кабинет, один баланс, один чат.</h1>
          <p className="section-copy">
            ElbrusWay AI агрегирует GPT, Claude, Gemini, DeepSeek и мультимодальные модели через RouterAI.
            Пользователь платит в рублях, получает токены и работает с AI как с единым сервисом.
          </p>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 28 }}>
          <Link href="/chat" className="button-primary">
            Попробовать бесплатно
          </Link>
          <Link href="/rates" className="button-secondary">
            Тарифы
          </Link>
        </div>
        <div className="grid-4" style={{ marginTop: 36 }}>
          {[
            ["Модели", "GPT, Claude, Gemini, DeepSeek"],
            ["Режимы", "Чат, Web Search, Images, Files"],
            ["Монетизация", "Подписки и пакеты токенов"],
            ["Инфраструктура", "Next.js + Prisma + Redis"]
          ].map(([label, value]) => (
            <div key={label} className="card">
              <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                {label}
              </div>
              <div style={{ fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "24px 0 18px" }}>
        <div className="badge">Модели</div>
        <h2 className="section-title" style={{ marginTop: 16 }}>
          Каталог AI-моделей
        </h2>
        <p className="section-copy" style={{ maxWidth: 760 }}>
          Проект подключён к живому каталогу RouterAI и может работать с {models.length} текстовыми моделями и
          мультимодальными вариантами без ручного хардкода списка.
        </p>
        <div className="grid-4">
          {featuredModels.map((model) => (
            <article key={model.id} className="card">
              <div className="muted" style={{ fontSize: 13 }}>{model.provider}</div>
              <h3 style={{ margin: "10px 0 8px", fontSize: 24 }}>{model.name}</h3>
              <p className="muted" style={{ minHeight: 72 }}>
                Контекст: {model.contextLength?.toLocaleString("ru-RU") || "n/a"} · In:{" "}
                {typeof model.pricing?.prompt === "number" ? `${(model.pricing.prompt * 1_000_000).toFixed(2)} ₽/1M` : "n/a"} ·
                Out:{" "}
                {typeof model.pricing?.completion === "number"
                  ? `${(model.pricing.completion * 1_000_000).toFixed(2)} ₽/1M`
                  : "n/a"}
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
                <span className="badge">{model.supportsImages ? "Мультимодальная" : "Текст"}</span>
                <span className="mono muted" style={{ fontSize: 12 }}>{model.id}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={{ padding: "32px 0 18px" }}>
        <div className="badge">Тарифы</div>
        <h2 className="section-title" style={{ marginTop: 16 }}>
          Подписки и токены
        </h2>
        <div className="grid-4">
          {planCatalog.map((plan) => (
            <article key={plan.id} className="card">
              <div className="muted">{plan.name}</div>
              <div style={{ fontSize: 34, fontWeight: 800, marginTop: 10 }}>{plan.price}</div>
              <div className="muted" style={{ margin: "6px 0 18px" }}>{plan.tokens}</div>
              <div style={{ display: "grid", gap: 10 }}>
                {plan.features.map((feature) => (
                  <div key={feature}>✓ {feature}</div>
                ))}
              </div>
              <Link href="/rates" className="button-secondary" style={{ marginTop: 18 }}>
                Выбрать
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
