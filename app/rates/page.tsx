"use client";

import { useEffect, useState } from "react";

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

export default function RatesPage() {
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [error, setError] = useState("");
  const [quoteMessage, setQuoteMessage] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadQuote(promoCode);
    }, promoCode ? 300 : 0);

    return () => window.clearTimeout(timeoutId);
  }, [promoCode]);

  async function loadQuote(code: string) {
    const params = new URLSearchParams();
    if (code.trim()) {
      params.set("promoCode", code.trim().toUpperCase());
    }

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

  return (
    <main className="shell" style={{ padding: "18px 0 56px" }}>
      <section className="panel" style={{ padding: 28 }}>
        <div className="badge">Тарифы</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Подписки и пакеты токенов</h1>
        <p className="section-copy" style={{ maxWidth: 760 }}>
          Тарифы считаются от реальных plan config на сервере. Промокод сразу пересчитывает цену и бонусы,
          а оплата создается уже с финальной суммой.
        </p>
        <div style={{ marginTop: 18, maxWidth: 360 }}>
          <input
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
            placeholder="Промокод"
            style={{
              width: "100%",
              minHeight: 48,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              color: "var(--text-primary)",
              padding: "0 14px"
            }}
          />
        </div>
        {quoteMessage ? <div style={{ color: "var(--success)", marginTop: 12 }}>{quoteMessage}</div> : null}
        {error ? <div style={{ color: "var(--error)", marginTop: 12 }}>{error}</div> : null}
        <div className="grid-4" style={{ marginTop: 28 }}>
          {plans.map((plan) => {
            const quote = plan.quote;
            const price = quote?.finalAmount ?? plan.priceRub;
            const priceChanged = typeof quote?.discountAmount === "number" && quote.discountAmount > 0;
            const tokens = quote?.finalTokens ?? plan.tokensPerMonth;

            return (
              <div key={plan.id} className="card">
                <div className="muted">{plan.name}</div>
                {priceChanged ? (
                  <div className="muted" style={{ marginTop: 8, textDecoration: "line-through" }}>{plan.priceRub} ₽</div>
                ) : null}
                <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>{price} ₽</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  {tokens.toLocaleString("ru-RU")} токенов · {plan.requestsPerHour}/час
                </div>
                {quote?.bonusTokens ? (
                  <div className="muted" style={{ marginTop: 6 }}>
                    + {quote.bonusTokens.toLocaleString("ru-RU")} бонусных токенов
                  </div>
                ) : null}
                <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
                  {(plan.features || [plan.description]).map((feature) => (
                    <div key={feature}>✓ {feature}</div>
                  ))}
                </div>
                <button
                  className="button-primary"
                  style={{ marginTop: 20, width: "100%" }}
                  onClick={() => void startCheckout({ planConfigId: plan.id }, `plan:${plan.id}`)}
                  disabled={loadingKey !== null || price === 0}
                >
                  {price === 0 ? "Доступен по умолчанию" : loadingKey === `plan:${plan.id}` ? "Переход..." : "Выбрать"}
                </button>
              </div>
            );
          })}
        </div>
        <div className="grid-4" style={{ marginTop: 24 }}>
          {packages.map((pack) => {
            const quote = pack.quote;
            const price = quote?.finalAmount ?? pack.priceRub;
            const tokens = quote?.finalTokens ?? pack.tokens;
            const priceChanged = typeof quote?.discountAmount === "number" && quote.discountAmount > 0;

            return (
              <div key={pack.id} className="card">
                <div className="muted">Пакет</div>
                <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>{tokens.toLocaleString("ru-RU")} токенов</div>
                {priceChanged ? (
                  <div className="muted" style={{ marginTop: 6, textDecoration: "line-through" }}>{pack.priceRub} ₽</div>
                ) : null}
                <div className="muted" style={{ marginTop: 6 }}>{price} ₽</div>
                {quote?.bonusTokens ? (
                  <div className="muted" style={{ marginTop: 6 }}>
                    Бонус: {quote.bonusTokens.toLocaleString("ru-RU")} токенов
                  </div>
                ) : null}
                <button
                  className="button-primary"
                  style={{ marginTop: 20, width: "100%" }}
                  onClick={() => void startCheckout({ packageId: pack.id }, `pack:${pack.id}`)}
                  disabled={loadingKey !== null}
                >
                  {loadingKey === `pack:${pack.id}` ? "Переход..." : "Купить"}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
