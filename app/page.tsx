import Link from "next/link";
import { planCatalog } from "@/lib/site";
import { getModels } from "@/lib/app";
import { getCuratedModelSections } from "@/lib/routerai/models";

export default async function HomePage() {
  const models = await getModels();
  const featuredModels = models.slice(0, 8);
  const curated = await getCuratedModelSections();
  const dailyModels = ((curated.sections.fast as typeof featuredModels) || featuredModels).slice(0, 4);

  return (
    <main className="shell" style={{ padding: "18px 0 56px" }}>
      <section
        className="panel"
        style={{
          padding: "64px 34px",
          overflow: "hidden",
          position: "relative",
          marginBottom: 28
        }}
      >
        <div className="badge">ElbrusWay AI</div>
        <div style={{ maxWidth: 760, paddingTop: 20 }}>
          <h1 className="section-title">Все главные нейросети в одном кабинете для работы, идей и повседневных задач.</h1>
          <p className="section-copy">
            Общайся с сильными моделями, собирай документы, создавай изображения, ищи информацию и храни материалы проекта
            в одном понятном сервисе. Без лишней настройки, без скачков между разными приложениями и с оплатой в рублях.
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
            ["Все в одном месте", "Чат, документы, изображения, поиск, файлы и проекты"],
            ["Для работы и жизни", "От коротких вопросов до сложных материалов и идей"],
            ["Понятный интерфейс", "Ничего лишнего на первом экране и быстрый переход к результату"],
            ["Оплата без сложностей", "Личные тарифы и удобный кабинет с историей и управлением"]
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
        <div className="grid-4" style={{ marginBottom: 24 }}>
          {[
            ["Лучшие модели для чата", curated.sections.top_chat],
            ["Лучшие модели для изображений", curated.sections.top_image],
            ["Лучшие для сложных задач", curated.sections.reasoning],
            ["Для повседневной работы", dailyModels]
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
          Подборка популярных моделей
        </h2>
        <p className="section-copy" style={{ maxWidth: 760 }}>
          Внутри уже доступно {models.length} моделей для общения, анализа, изображений и ежедневной работы.
          Ты выбираешь задачу, а не разбираешься в технических слоях.
        </p>
        <div className="grid-4">
          {featuredModels.map((model) => (
            <article key={model.id} className="card">
              <div className="muted" style={{ fontSize: 13 }}>{model.provider}</div>
              <h3 style={{ margin: "10px 0 8px", fontSize: 24 }}>{model.name}</h3>
              <p className="muted" style={{ minHeight: 72 }}>
                {model.supportsImages
                  ? "Подходит для текста, изображений и мультимодальных задач."
                  : "Подходит для общения, текстов, идей и повседневной работы."}
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
                <span className="badge">{model.supportsImages ? "Изображения и текст" : "Текст и диалог"}</span>
                <span className="muted" style={{ fontSize: 12 }}>до {model.contextLength?.toLocaleString("ru-RU") || "—"} токенов контекста</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={{ padding: "32px 0 18px" }}>
        <div className="badge">Почему ElbrusWay</div>
        <h2 className="section-title" style={{ marginTop: 16 }}>Сервис собран вокруг пользы, а не вокруг технических деталей</h2>
        <div className="grid-4">
          {[
            ["Один кабинет", "Все основные сценарии собраны в одном месте: чат, файлы, документы, редактор и поиск."],
            ["Быстрый путь к результату", "Ответы легко превращаются в документы, изображения и материалы по проектам."],
            ["Аккуратная подача", "Интерфейс не перегружает деталями и не требует разбираться в служебных терминах."],
            ["Удобно для роста", "Сервис одинаково подходит для личной работы, команды и более интенсивного использования."]
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
          Тарифы для личной работы, команды и интенсивного использования
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
