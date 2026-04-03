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
      <section className="hero-surface hero-home">
        <div className="hero-copy">
          <div className="eyebrow">ElbrusWay AI</div>
          <h1 className="hero-title">
            Все нейросети
            <br />
            <span>без барьеров</span>
          </h1>
          <p className="hero-text">
            Сервис собран как finished product: сначала понятный старт, потом инструменты, файлы, документы и проекты
            без dev-console ощущения.
          </p>
          <div className="hero-actions">
            <Link href="/chat" className="button-primary">
              Начать диалог
            </Link>
            <Link href="/auth/register" className="button-secondary">
              Создать аккаунт
            </Link>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <strong>350+</strong>
              <span>нейросетей</span>
            </div>
            <div className="hero-stat">
              <strong>0 ₽</strong>
              <span>для старта</span>
            </div>
            <div className="hero-stat">
              <strong>Без VPN</strong>
              <span>работает в РФ</span>
            </div>
          </div>
          <div className="hero-inline-grid">
            {["Центрированный chat start screen", "Понятный model picker", "Мягкий тёмный интерфейс"].map((item) => (
              <div key={item} className="hero-chip">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="hero-panel">
          <div className="surface hero-preview-card">
            <div className="eyebrow">Как это работает</div>
            <h2 className="surface-title">Главный фокус теперь один</h2>
            <div className="feature-list">
              <div className="feature-row">
                <strong>1. Выберите модель</strong>
                <span>Через вкладки Популярные, ChatGPT, Claude, Gemini, Grok, Изображения, Видео и Аудио.</span>
              </div>
              <div className="feature-row">
                <strong>2. Напишите сообщение</strong>
                <span>Поле ввода находится в центре экрана и не спорит с вторичными настройками.</span>
              </div>
              <div className="feature-row">
                <strong>3. Откройте дополнительные панели только когда они нужны</strong>
                <span>История, проект, файлы и режимы спрятаны за понятными действиями.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="content-grid two-columns">
        <div className="surface">
          <div className="eyebrow">Популярные модели</div>
          <h2 className="surface-title">Выбор не начинается с длинного select</h2>
          <p className="surface-copy">На первом плане только те модели, которые обычному пользователю действительно легко понять.</p>
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
          <div className="eyebrow">Вкладки</div>
          <h2 className="surface-title">Категории, которые понимаются с первого взгляда</h2>
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
        <div className="eyebrow">Сценарии</div>
        <h2 className="surface-title">Понятные действия вместо технической кухни</h2>
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
