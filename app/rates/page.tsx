"use client";

import { useEffect, useMemo, useState } from "react";

type Quote = {
  promoCode: {
    code: string;
    discountPercent: number;
    bonusTokens: number;
    referralPercent: number | null;
  } | null;
  baseAmount: number;
  finalAmount: number;
  discountAmount: number;
  baseTokens: number;
  finalTokens: number;
  bonusTokens: number;
};

type PlanConfig = {
  id: string;
  code: string;
  name: string;
  basePlan: string;
  priceRub: number;
  tokensPerMonth: number;
  requestsPerHour: number;
  description: string;
  features: string[];
  quote: Quote | null;
};

type TokenPackage = {
  id: string;
  name: string;
  tokens: number;
  priceRub: number;
  quote: Quote | null;
};

const tokenPackages = [
  { id: "pack_5m", label: "5 млн токенов", price: 149 },
  { id: "pack_20m", label: "20 млн токенов", price: 490 },
  { id: "pack_50m", label: "50 млн токенов", price: 990 },
  { id: "pack_200m", label: "200 млн токенов", price: 2990 }
] as const;

export default function RatesPage() {
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [error, setError] = useState("");
  const [quoteMessage, setQuoteMessage] = useState("");
  const [billingCycle, setBillingCycle] = useState<"month" | "year">("month");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadQuote(promoCode);
    }, promoCode ? 300 : 0);

    return () => window.clearTimeout(timeoutId);
  }, [promoCode]);

  async function loadQuote(code: string) {
    const params = new URLSearchParams();
    if (code.trim()) params.set("promoCode", code.trim().toUpperCase());

    const response = await fetch(`/api/payments/quote${params.toString() ? `?${params.toString()}` : ""}`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.message || "Не удалось загрузить цены");
      return;
    }

    setPlans(payload.plans || []);
    setPackages(payload.packages || []);
    setError("");

    const activeQuote = [...(payload.plans || []), ...(payload.packages || [])]
      .map((entry: { quote: Quote | null }) => entry.quote)
      .find((quote: Quote | null) => quote?.promoCode);

    if (activeQuote?.promoCode) {
      setQuoteMessage(
        `Промокод ${activeQuote.promoCode.code}: скидка ${activeQuote.promoCode.discountPercent}% и бонус ${activeQuote.bonusTokens.toLocaleString("ru-RU")} токенов`
      );
      return;
    }

    setQuoteMessage(code ? "Промокод не применён к выбранным тарифам или пакетам" : "");
  }

  async function startCheckout(payload: { planConfigId?: string; packageId?: string }, key: string) {
    setError("");
    setLoadingKey(key);

    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          promoCode: promoCode || undefined
        })
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Не удалось создать платеж");
      }

      if (typeof result.confirmationUrl !== "string") {
        throw new Error("PAYMENT_REDIRECT_MISSING");
      }

      window.location.href = result.confirmationUrl;
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setLoadingKey(null);
    }
  }

  const packageCards = useMemo(() => {
    if (packages.length > 0) return packages;
    return tokenPackages.map((item) => ({
      id: item.id,
      name: item.label,
      tokens: Number(item.label.replace(/[^\d]/g, "")) * 1_000_000,
      priceRub: item.price,
      quote: null
    }));
  }, [packages]);

  return (
    <div className="page-stack">
      <section className="surface-elevated">
        <div className="eyebrow">Тарифы</div>
        <h1 className="surface-title">Подписки и пакеты токенов</h1>
        <p className="surface-copy">
          Выберите удобный режим оплаты, подключите тариф и при необходимости докупайте токены отдельными пакетами.
        </p>

        <div className="toolbar-row" style={{ marginTop: 16 }}>
          <div className="toggle-row">
            <button type="button" className={billingCycle === "month" ? "toggle-pill on" : "toggle-pill"} onClick={() => setBillingCycle("month")}>
              Месяц
            </button>
            <button type="button" className={billingCycle === "year" ? "toggle-pill on" : "toggle-pill"} onClick={() => setBillingCycle("year")}>
              Год
            </button>
          </div>
          {billingCycle === "year" ? <span className="success-text">Скидка 20% при расчёте на год</span> : null}
        </div>

        <div style={{ marginTop: 18, maxWidth: 360 }}>
          <input
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
            placeholder="Промокод"
          />
        </div>

        {quoteMessage ? <div className="success-banner" style={{ marginTop: 12 }}>{quoteMessage}</div> : null}
        {error ? <div className="error-banner" style={{ marginTop: 12 }}>{error}</div> : null}
      </section>

      <section className="surface">
        <div className="eyebrow">Подписки</div>
        <h2 className="surface-title">План для старта, работы и высокой нагрузки</h2>
        <div className="pricing-grid">
          {plans.map((plan) => {
            const quote = plan.quote;
            const monthPrice = quote?.finalAmount ?? plan.priceRub;
            const displayedPrice = billingCycle === "year" ? Math.round(monthPrice * 12 * 0.8) : monthPrice;
            const displayedLabel = billingCycle === "year" ? "в год" : "в месяц";
            const tokens = (quote?.finalTokens ?? plan.tokensPerMonth) * (billingCycle === "year" ? 12 : 1);
            const featured = plan.basePlan === "PRO";

            return (
              <article key={plan.id} className={featured ? "pricing-card featured" : "pricing-card"}>
                <div className="pricing-head">
                  <strong>{plan.name}</strong>
                  <span>{displayedPrice} ₽</span>
                </div>
                <div className="muted-text">{displayedLabel}</div>
                <div className="surface-copy">{tokens.toLocaleString("ru-RU")} токенов · {plan.requestsPerHour}/час</div>
                {quote?.bonusTokens ? (
                  <div className="success-text">+ {quote.bonusTokens.toLocaleString("ru-RU")} бонусных токенов</div>
                ) : null}
                <div className="feature-list compact-list">
                  {(plan.features.length ? plan.features : [plan.description]).map((feature) => (
                    <div key={feature} className="feature-row">
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <button
                  className="button-primary"
                  onClick={() => void startCheckout({ planConfigId: plan.id }, `plan:${plan.id}`)}
                  disabled={loadingKey !== null || monthPrice === 0}
                >
                  {monthPrice === 0 ? "Доступен по умолчанию" : loadingKey === `plan:${plan.id}` ? "Переход..." : "Выбрать"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="surface">
        <div className="eyebrow">Пакеты</div>
        <h2 className="surface-title">Разовые пакеты токенов</h2>
        <div className="pricing-grid">
          {packageCards.map((pack, index) => {
            const quote = pack.quote;
            const price = quote?.finalAmount ?? pack.priceRub;
            const tokens = quote?.finalTokens ?? pack.tokens;
            const canCheckout = packages.some((entry) => entry.id === pack.id);

            return (
              <article key={pack.id} className={index === 1 ? "pricing-card featured" : "pricing-card"}>
                <div className="pricing-head">
                  <strong>{pack.name}</strong>
                  <span>{price} ₽</span>
                </div>
                <div className="surface-copy">{tokens.toLocaleString("ru-RU")} токенов</div>
                {quote?.bonusTokens ? (
                  <div className="success-text">+ {quote.bonusTokens.toLocaleString("ru-RU")} бонусных токенов</div>
                ) : null}
                <div className="feature-list compact-list">
                  <div className="feature-row">
                    <span>Подходит для разовой докупки без смены тарифа.</span>
                  </div>
                  <div className="feature-row">
                    <span>Токены сразу зачисляются на баланс аккаунта.</span>
                  </div>
                </div>
                <button
                  className="button-primary"
                  onClick={() => canCheckout && void startCheckout({ packageId: pack.id }, `pack:${pack.id}`)}
                  disabled={loadingKey !== null || !canCheckout}
                >
                  {!canCheckout ? "Скоро" : loadingKey === `pack:${pack.id}` ? "Переход..." : "Купить"}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
