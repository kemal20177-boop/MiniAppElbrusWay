import Link from "next/link";
import { planCatalog } from "@/lib/site";
import { getModels } from "@/lib/app";
import { getCuratedModelSections } from "@/lib/routerai/models";

export default async function HomePage() {
  const models = await getModels();
  const featuredModels = models.slice(0, 8);
  const curated = await getCuratedModelSections();

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
        <div className="badge">RouterAI-powered AI Workspace</div>
        <div style={{ maxWidth: 760, paddingTop: 20 }}>
          <h1 className="section-title">Один AI workspace для чатов, файлов, документов и мультимодальных моделей без VPN.</h1>
          <p className="section-copy">
            ElbrusWay AI объединяет ChatGPT, Claude, Gemini, Grok, image и vision-модели через RouterAI API.
            Пользователь платит в рублях, работает в проектах, хранит файлы, превращает ответы в документы и управляет всем из одного кабинета.
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
            ["Top models", "ChatGPT, Claude, Gemini, Grok, Nano Banana"],
            ["Workspace", "Chat, Files, Documents, Canvas, Projects"],
            ["Multimodal", "Image, Vision, Audio, Search, PDF"],
            ["Ops", "Admin, audit logs, jobs, billing, limits"]
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
        <div className="grid-3" style={{ marginBottom: 24 }}>
          {[
            ["Top chat", curated.sections.top_chat],
            ["Top image", curated.sections.top_image],
            ["Reasoning", curated.sections.reasoning]
          ].map(([label, items]) => (
            <div key={String(label)} className="card">
              <div className="badge">{String(label)}</div>
              <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
                {((items as typeof featuredModels) || []).slice(0, 4).map((model) => (
                  <div key={model.id} className="muted">
                    {model.name} · {model.provider}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
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
        <div className="badge">Почему ElbrusWay</div>
        <h2 className="section-title" style={{ marginTop: 16 }}>Сервис ощущается как finished SaaS, а не как dev console</h2>
        <div className="grid-4">
          {[
            ["Projects-first", "Проекты держат вместе чаты, файлы, документы, canvas и search sessions."],
            ["RouterAI native", "Каталог моделей, multimodal input и image generation идут через RouterAI API."],
            ["Документы из чата", "Ответ можно превратить в документ и открыть в canvas без копипаста."],
            ["Control center", "Админка показывает jobs, storage, workspace-сущности и состояния ошибок."]
          ].map(([title, text]) => (
            <article key={String(title)} className="card">
              <h3 style={{ marginTop: 0 }}>{title}</h3>
              <p className="muted">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ padding: "32px 0 18px" }}>
        <div className="badge">Тарифы</div>
        <h2 className="section-title" style={{ marginTop: 16 }}>
          Тарифы для работы, команды и heavy usage
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
