import Link from "next/link";
import { getModels } from "@/lib/app";
import { getCuratedModelSections } from "@/lib/routerai/models";
import { homeUseCases, planCatalog, quickModelFamilies } from "@/lib/site";
import { buildUiModels } from "@/lib/model-ui";

export default async function HomePage() {
  const [models, curated] = await Promise.all([getModels(), getCuratedModelSections()]);
  const uiModels = buildUiModels(models as unknown as Array<Record<string, unknown>>);
  const topCards = [
    curated.leaders.chatgpt,
    curated.leaders.claude,
    curated.leaders.gemini,
    curated.leaders.grok,
    curated.leaders.nanoBanana
  ]
    .filter(Boolean)
    .slice(0, 5)
    .map((item) => uiModels.find((model) => model.id === item?.id))
    .filter(Boolean);

  return (
    <div className="page-stack">
      <section className="hero-surface">
        <div className="hero-copy">
          <div className="eyebrow">ElbrusWay AI</div>
          <h1 className="hero-title">Один понятный AI-сервис для чата, изображений, видео, аудио, документов и файлов.</h1>
          <p className="hero-text">
            Начните с обычного запроса, выберите любимую модель в один клик и переходите к нужному сценарию без
            лишних технических настроек.
          </p>
          <div className="hero-actions">
            <Link href="/chat" className="button-primary">
              Открыть чат
            </Link>
            <Link href="/tools/image" className="button-secondary">
              Создать изображение
            </Link>
          </div>
          <div className="hero-inline-grid">
            {[
              "Быстрый вход в чат",
              "Отдельные сценарии для медиа",
              "Файлы, документы и проекты в одном месте"
            ].map((item) => (
              <div key={item} className="hero-chip">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="hero-panel">
          <div className="surface">
            <div className="eyebrow">Быстрый старт</div>
            <h2 className="surface-title">Что можно сделать прямо сейчас</h2>
            <div className="quick-entry-grid">
              <Link href="/chat" className="quick-entry-card">
                <strong>Запустить чат</strong>
                <span>Выбрать модель и начать с одного сообщения</span>
              </Link>
              <Link href="/tools/image" className="quick-entry-card">
                <strong>Создать изображение</strong>
                <span>Сгенерировать визуал и сохранить в файлы</span>
              </Link>
              <Link href="/tools/video" className="quick-entry-card">
                <strong>Подготовить видео</strong>
                <span>Собрать сценарий, сцены и постановку задачи</span>
              </Link>
              <Link href="/documents" className="quick-entry-card">
                <strong>Собрать документ</strong>
                <span>Перенести идею в структуру, текст и материалы</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="content-grid two-columns">
        <div className="surface">
          <div className="eyebrow">Популярные модели</div>
          <h2 className="surface-title">Быстрый выбор без длинных списков</h2>
          <p className="surface-copy">Внутри уже собраны самые заметные модели для общения, идей и визуального контента.</p>
          <div className="model-grid compact">
            {(topCards.length ? topCards : uiModels.slice(0, 6)).map((model) => (
              <div key={model!.id} className="model-card static">
                <div className="mini-badge">Топ</div>
                <div className="model-card-title">{model!.name}</div>
                <div className="model-card-copy">{model!.summary}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface">
          <div className="eyebrow">Модельные входы</div>
          <h2 className="surface-title">Выбирайте по знакомому имени</h2>
          <div className="feature-list">
            {quickModelFamilies.map((item) => (
              <div key={item.key} className="feature-row">
                <strong>{item.title}</strong>
                <span>{item.summary}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="surface">
        <div className="eyebrow">Для чего сервис</div>
        <h2 className="surface-title">Понятные сценарии вместо технической кухни</h2>
        <div className="use-case-grid">
          {homeUseCases.map((item) => (
            <article key={item} className="feature-card">
              <strong>{item}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="surface">
        <div className="eyebrow">Тарифы</div>
        <h2 className="surface-title">Планы для старта, личной работы и постоянной нагрузки</h2>
        <div className="pricing-grid">
          {planCatalog.map((plan) => (
            <article key={plan.id} className="pricing-card">
              <div className="pricing-head">
                <strong>{plan.name}</strong>
                <span>{plan.price}</span>
              </div>
              <div className="muted-text">{plan.tokens}</div>
              <div className="feature-list compact-list">
                {plan.features.map((feature) => (
                  <div key={feature} className="feature-row">
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              <Link href="/rates" className="button-secondary">
                Смотреть тариф
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
