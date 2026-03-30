"use client";

import { FormEvent, useEffect, useState } from "react";

type AdminUser = Record<string, unknown>;
type BillingPlan = Record<string, unknown>;
type PromoCode = Record<string, unknown>;
type ReferralProgram = Record<string, unknown>;
type ReferralReward = Record<string, unknown>;

const fieldStyle = {
  width: "100%",
  minHeight: 44,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-primary)",
  padding: "0 12px"
} as const;

const areaStyle = {
  ...fieldStyle,
  padding: "12px",
  minHeight: 96
} as const;

function toInputDateTimeValue(value: unknown) {
  if (!value || typeof value !== "string") {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDateTime(value: unknown) {
  if (!value || typeof value !== "string") {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("ru-RU");
}

export default function AdminPage() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [payments, setPayments] = useState<Array<Record<string, unknown>>>([]);
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [referralProgram, setReferralProgram] = useState<ReferralProgram | null>(null);
  const [referralRewards, setReferralRewards] = useState<ReferralReward[]>([]);
  const [topReferrers, setTopReferrers] = useState<Array<Record<string, unknown>>>([]);
  const [models, setModels] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [newPlan, setNewPlan] = useState({
    code: "",
    name: "",
    basePlan: "BASE",
    priceRub: "490",
    tokensPerMonth: "15000000",
    requestsPerHour: "200",
    description: "",
    features: "",
    sortOrder: "10",
    isActive: true,
    isPublic: true
  });

  const [newPromo, setNewPromo] = useState({
    code: "",
    description: "",
    billingPlanId: "",
    discountPercent: "0",
    bonusTokens: "0",
    referralPercent: "",
    maxUses: "",
    expiresAt: "",
    isActive: true
  });

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setError("");
    const responses = await Promise.all([
      fetch("/api/admin/stats"),
      fetch("/api/admin/users"),
      fetch("/api/admin/payments"),
      fetch("/api/admin/logs"),
      fetch("/api/admin/plans"),
      fetch("/api/admin/promocodes"),
      fetch("/api/admin/referrals"),
      fetch("/api/admin/models")
    ]);

    const payloads = await Promise.all(responses.map((response) => response.json()));
    const failed = responses.find((response) => !response.ok);
    if (failed) {
      setError("Нужна роль ADMIN или миграция backend-схемы еще не применена.");
      return;
    }

    setStats(payloads[0].stats);
    setUsers(payloads[1].users || []);
    setPayments(payloads[2].payments || []);
    setLogs(payloads[3].logs || []);
    setPlans(payloads[4].plans || []);
    setPromoCodes(payloads[5].promoCodes || []);
    setReferralProgram(payloads[6].program || null);
    setReferralRewards(payloads[6].rewards || []);
    setTopReferrers(payloads[6].topReferrers || []);
    setModels(payloads[7].models || []);
  }

  async function updateUser(userId: string, payload: Record<string, unknown>) {
    setMessage("");
    setError("");
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.message || "Не удалось обновить пользователя");
      return;
    }

    setMessage("Пользователь обновлен");
    await load();
  }

  async function savePlan(planId: string, payload: Record<string, unknown>) {
    setMessage("");
    setError("");
    const response = await fetch(`/api/admin/plans/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.message || "Не удалось обновить тариф");
      return;
    }

    setMessage("Тариф обновлен");
    await load();
  }

  async function deletePlan(planId: string) {
    setError("");
    const response = await fetch(`/api/admin/plans/${planId}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) {
      setError(result.message || "Не удалось удалить тариф");
      return;
    }

    setMessage("Тариф удален");
    await load();
  }

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/admin/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newPlan,
        code: newPlan.code.toUpperCase(),
        priceRub: Number(newPlan.priceRub),
        tokensPerMonth: Number(newPlan.tokensPerMonth),
        requestsPerHour: Number(newPlan.requestsPerHour),
        sortOrder: Number(newPlan.sortOrder),
        features: newPlan.features
          .split("\n")
          .map((entry) => entry.trim())
          .filter(Boolean)
      })
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.message || "Не удалось создать тариф");
      return;
    }

    setMessage("Тариф создан");
    setNewPlan({
      code: "",
      name: "",
      basePlan: "BASE",
      priceRub: "490",
      tokensPerMonth: "15000000",
      requestsPerHour: "200",
      description: "",
      features: "",
      sortOrder: "10",
      isActive: true,
      isPublic: true
    });
    await load();
  }

  async function savePromo(promoId: string, payload: Record<string, unknown>) {
    setMessage("");
    setError("");
    const response = await fetch(`/api/admin/promocodes/${promoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.message || "Не удалось обновить промокод");
      return;
    }

    setMessage("Промокод обновлен");
    await load();
  }

  async function deletePromo(promoId: string) {
    setError("");
    const response = await fetch(`/api/admin/promocodes/${promoId}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) {
      setError(result.message || "Не удалось удалить промокод");
      return;
    }

    setMessage("Промокод удален");
    await load();
  }

  async function createPromo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/admin/promocodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newPromo,
        code: newPromo.code.toUpperCase(),
        billingPlanId: newPromo.billingPlanId || null,
        discountPercent: Number(newPromo.discountPercent),
        bonusTokens: Number(newPromo.bonusTokens),
        referralPercent: newPromo.referralPercent ? Number(newPromo.referralPercent) : null,
        maxUses: newPromo.maxUses ? Number(newPromo.maxUses) : null,
        expiresAt: newPromo.expiresAt || null
      })
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.message || "Не удалось создать промокод");
      return;
    }

    setMessage("Промокод создан");
    setNewPromo({
      code: "",
      description: "",
      billingPlanId: "",
      discountPercent: "0",
      bonusTokens: "0",
      referralPercent: "",
      maxUses: "",
      expiresAt: "",
      isActive: true
    });
    await load();
  }

  async function saveReferralProgram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!referralProgram) {
      return;
    }

    setError("");
    const response = await fetch("/api/admin/referrals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isEnabled: Boolean(referralProgram.isEnabled),
        defaultRewardPercent: Number(referralProgram.defaultRewardPercent || 0),
        refereeBonusTokens: Number(referralProgram.refereeBonusTokens || 0)
      })
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.message || "Не удалось обновить реферальную программу");
      return;
    }

    setMessage("Реферальная программа обновлена");
    await load();
  }

  async function saveReferralReward(rewardId: string, status: string) {
    setError("");
    const response = await fetch(`/api/admin/referrals/${rewardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.message || "Не удалось обновить реферальную выплату");
      return;
    }

    setMessage("Статус реферальной выплаты обновлен");
    await load();
  }

  async function saveModel(modelId: string, payload: Record<string, unknown>) {
    setError("");
    const response = await fetch(`/api/admin/models/${modelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.message || "Не удалось обновить модель");
      return;
    }

    setMessage("Модель обновлена");
    await load();
  }

  return (
    <main className="shell" style={{ padding: "18px 0 56px" }}>
      <section className="panel" style={{ padding: 28 }}>
        <div className="badge">Admin</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Административная панель</h1>
        {error ? <div style={{ color: "var(--error)", marginTop: 12 }}>{error}</div> : null}
        {message ? <div style={{ color: "var(--success)", marginTop: 12 }}>{message}</div> : null}

        <div className="grid-4" style={{ marginTop: 28 }}>
          {[
            ["Пользователи", String(stats?.users ?? "...")],
            ["Выручка", `${String(stats?.revenue30d ?? "...")} ₽`],
            ["Тарифы", String(stats?.plansCount ?? "...")],
            ["Промокоды", String(stats?.activePromoCodesCount ?? "...")],
            ["Реф. выплаты", `${String(stats?.referralRewardsRub ?? "...")} ₽`],
            ["Реф. сделок", String(stats?.referralRewardsCount ?? "...")],
            ["Расход RouterAI", `${String(stats?.realCostRub ?? "...")} ₽`],
            [
              "Баланс RouterAI",
              stats?.routerCredits == null ? String(stats?.routerCreditsError ?? "...") : `${String(stats?.routerCredits)} ₽`
            ]
          ].map(([label, value]) => (
            <div key={label} className="card">
              <div className="muted">{label}</div>
              <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800 }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="grid-3" style={{ marginTop: 24 }}>
          <form className="card" onSubmit={createPlan}>
            <h2 style={{ marginTop: 0 }}>Новый тариф</h2>
            <div style={{ display: "grid", gap: 10 }}>
              <input value={newPlan.code} onChange={(event) => setNewPlan((prev) => ({ ...prev, code: event.target.value }))} placeholder="Код" style={fieldStyle} />
              <input value={newPlan.name} onChange={(event) => setNewPlan((prev) => ({ ...prev, name: event.target.value }))} placeholder="Название" style={fieldStyle} />
              <select value={newPlan.basePlan} onChange={(event) => setNewPlan((prev) => ({ ...prev, basePlan: event.target.value }))} style={fieldStyle}>
                {["FREE", "BASE", "PRO", "ULTRA", "BUSINESS"].map((plan) => <option key={plan} value={plan}>{plan}</option>)}
              </select>
              <input value={newPlan.priceRub} onChange={(event) => setNewPlan((prev) => ({ ...prev, priceRub: event.target.value }))} placeholder="Цена ₽" style={fieldStyle} />
              <input value={newPlan.tokensPerMonth} onChange={(event) => setNewPlan((prev) => ({ ...prev, tokensPerMonth: event.target.value }))} placeholder="Токены" style={fieldStyle} />
              <input value={newPlan.requestsPerHour} onChange={(event) => setNewPlan((prev) => ({ ...prev, requestsPerHour: event.target.value }))} placeholder="Запросов/час" style={fieldStyle} />
              <input value={newPlan.sortOrder} onChange={(event) => setNewPlan((prev) => ({ ...prev, sortOrder: event.target.value }))} placeholder="Порядок сортировки" style={fieldStyle} />
              <textarea value={newPlan.description} onChange={(event) => setNewPlan((prev) => ({ ...prev, description: event.target.value }))} placeholder="Описание" style={areaStyle} />
              <textarea value={newPlan.features} onChange={(event) => setNewPlan((prev) => ({ ...prev, features: event.target.value }))} placeholder="Фичи, по одной в строке" style={areaStyle} />
              <label className="muted"><input type="checkbox" checked={newPlan.isActive} onChange={(event) => setNewPlan((prev) => ({ ...prev, isActive: event.target.checked }))} /> Активен</label>
              <label className="muted"><input type="checkbox" checked={newPlan.isPublic} onChange={(event) => setNewPlan((prev) => ({ ...prev, isPublic: event.target.checked }))} /> Публичный</label>
              <button className="button-primary" type="submit">Создать тариф</button>
            </div>
          </form>

          <form className="card" onSubmit={createPromo}>
            <h2 style={{ marginTop: 0 }}>Новый промокод</h2>
            <div style={{ display: "grid", gap: 10 }}>
              <input value={newPromo.code} onChange={(event) => setNewPromo((prev) => ({ ...prev, code: event.target.value }))} placeholder="Код" style={fieldStyle} />
              <input value={newPromo.description} onChange={(event) => setNewPromo((prev) => ({ ...prev, description: event.target.value }))} placeholder="Описание" style={fieldStyle} />
              <select value={newPromo.billingPlanId} onChange={(event) => setNewPromo((prev) => ({ ...prev, billingPlanId: event.target.value }))} style={fieldStyle}>
                <option value="">Любой тариф</option>
                {plans.map((plan) => <option key={String(plan.id)} value={String(plan.id)}>{String(plan.name)}</option>)}
              </select>
              <input value={newPromo.discountPercent} onChange={(event) => setNewPromo((prev) => ({ ...prev, discountPercent: event.target.value }))} placeholder="Скидка %" style={fieldStyle} />
              <input value={newPromo.bonusTokens} onChange={(event) => setNewPromo((prev) => ({ ...prev, bonusTokens: event.target.value }))} placeholder="Бонус токены" style={fieldStyle} />
              <input value={newPromo.referralPercent} onChange={(event) => setNewPromo((prev) => ({ ...prev, referralPercent: event.target.value }))} placeholder="Referral %" style={fieldStyle} />
              <input value={newPromo.maxUses} onChange={(event) => setNewPromo((prev) => ({ ...prev, maxUses: event.target.value }))} placeholder="Макс. использований" style={fieldStyle} />
              <input value={newPromo.expiresAt} onChange={(event) => setNewPromo((prev) => ({ ...prev, expiresAt: event.target.value }))} type="datetime-local" style={fieldStyle} />
              <label className="muted"><input type="checkbox" checked={newPromo.isActive} onChange={(event) => setNewPromo((prev) => ({ ...prev, isActive: event.target.checked }))} /> Активен</label>
              <button className="button-primary" type="submit">Создать промокод</button>
            </div>
          </form>

          <form className="card" onSubmit={saveReferralProgram}>
            <h2 style={{ marginTop: 0 }}>Реферальная программа</h2>
            <div style={{ display: "grid", gap: 10 }}>
              <label className="muted">
                <input
                  type="checkbox"
                  checked={Boolean(referralProgram?.isEnabled)}
                  onChange={(event) => setReferralProgram((prev) => ({ ...(prev || {}), isEnabled: event.target.checked }))}
                />{" "}
                Включена
              </label>
              <input
                value={String(referralProgram?.defaultRewardPercent ?? 10)}
                onChange={(event) =>
                  setReferralProgram((prev) => ({ ...(prev || {}), defaultRewardPercent: Number(event.target.value) }))
                }
                placeholder="% вознаграждения"
                style={fieldStyle}
              />
              <input
                value={String(referralProgram?.refereeBonusTokens ?? 0)}
                onChange={(event) =>
                  setReferralProgram((prev) => ({ ...(prev || {}), refereeBonusTokens: Number(event.target.value) }))
                }
                placeholder="Бонус токены новичку"
                style={fieldStyle}
              />
              <button className="button-primary" type="submit">Сохранить программу</button>
            </div>
          </form>
        </div>

        <div className="grid-3" style={{ marginTop: 24 }}>
          <div className="card" style={{ overflow: "auto" }}>
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Пользователи</div>
            <div style={{ display: "grid", gap: 14 }}>
              {users.slice(0, 30).map((user) => (
                <UserEditor key={String(user.id)} user={user} plans={plans} onSave={updateUser} />
              ))}
            </div>
          </div>

          <div className="card" style={{ overflow: "auto" }}>
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Тарифы</div>
            <div style={{ display: "grid", gap: 14 }}>
              {plans.map((plan) => (
                <PlanEditor key={String(plan.id)} plan={plan} onSave={savePlan} onDelete={deletePlan} />
              ))}
            </div>
          </div>

          <div className="card" style={{ overflow: "auto" }}>
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Промокоды</div>
            <div style={{ display: "grid", gap: 14 }}>
              {promoCodes.map((promo) => (
                <PromoEditor key={String(promo.id)} promo={promo} plans={plans} onSave={savePromo} onDelete={deletePromo} />
              ))}
            </div>
          </div>
        </div>

        <div className="grid-3" style={{ marginTop: 24 }}>
          <div className="card">
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Топ рефереры</div>
            {topReferrers.slice(0, 10).map((entry, index) => (
              <div key={index} className="muted">
                {String((entry.referrer as Record<string, unknown> | null)?.email || "...")} · {String(entry.amountRub)} ₽ ·{" "}
                {String(entry.rewardsCount)} выплат
              </div>
            ))}
          </div>

          <div className="card">
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Реферальные начисления</div>
            <div style={{ display: "grid", gap: 12 }}>
              {referralRewards.slice(0, 16).map((reward) => (
                <ReferralRewardEditor key={String(reward.id)} reward={reward} onSave={saveReferralReward} />
              ))}
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Логи и платежи</div>
            {payments.slice(0, 6).map((payment) => (
              <div key={String(payment.id)} className="muted">
                {String(payment.description)} · {String(payment.amount)} ₽ · {String(payment.status)}
              </div>
            ))}
            <div style={{ marginTop: 16, fontWeight: 800, marginBottom: 12 }}>Последние запросы</div>
            {logs.slice(0, 6).map((log) => (
              <div key={String(log.id)} className="muted">
                {String(log.model)} · {String(log.totalTokens)} токенов
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Модели</div>
          <div style={{ display: "grid", gap: 14 }}>
            {models.slice(0, 20).map((model) => (
              <ModelEditor key={String(model.id)} model={model} onSave={saveModel} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function UserEditor({
  user,
  plans,
  onSave
}: {
  user: AdminUser;
  plans: BillingPlan[];
  onSave: (id: string, payload: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(String(user.name || ""));
  const [plan, setPlan] = useState(String(user.plan || "FREE"));
  const [billingPlanId, setBillingPlanId] = useState(String((user.billingPlan as Record<string, unknown> | null)?.id || ""));
  const [role, setRole] = useState(String(user.role || "USER"));
  const [tokenBalance, setTokenBalance] = useState(String(user.tokenBalance || 0));
  const [tokenDelta, setTokenDelta] = useState("0");
  const [planExpiresAt, setPlanExpiresAt] = useState(toInputDateTimeValue(user.planExpiresAt));
  const [referralPercent, setReferralPercent] = useState(String(user.referralRewardPercentOverride ?? ""));
  const [reason, setReason] = useState("Обновление из админ-панели");

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontWeight: 700 }}>{String(user.email)}</div>
      <div className="muted" style={{ marginTop: 4 }}>
        Баланс: {String(user.tokenBalance)} · Код: {String(user.referralCode || "—")} · Рефералов: {String(user.referralsCount || 0)}
      </div>
      <div className="muted" style={{ marginTop: 4 }}>
        Текущий custom тариф: {String((user.billingPlan as Record<string, unknown> | null)?.name || "—")} · Истекает: {formatDateTime(user.planExpiresAt)}
      </div>
      <div className="muted" style={{ marginTop: 4 }}>
        Пригласил: {String((user.referredBy as Record<string, unknown> | null)?.email || "—")}
      </div>
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Имя" style={fieldStyle} />
        <select value={role} onChange={(event) => setRole(event.target.value)} style={fieldStyle}>
          {["USER", "ADMIN"].map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <select value={plan} onChange={(event) => setPlan(event.target.value)} style={fieldStyle}>
          {["FREE", "BASE", "PRO", "ULTRA", "BUSINESS"].map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <select value={billingPlanId} onChange={(event) => setBillingPlanId(event.target.value)} style={fieldStyle}>
          <option value="">Без кастомного тарифа</option>
          {plans.map((entry) => <option key={String(entry.id)} value={String(entry.id)}>{String(entry.name)}</option>)}
        </select>
        <input value={tokenBalance} onChange={(event) => setTokenBalance(event.target.value)} placeholder="Абсолютный баланс" style={fieldStyle} />
        <input value={tokenDelta} onChange={(event) => setTokenDelta(event.target.value)} placeholder="Дельта баланса, +/-" style={fieldStyle} />
        <input value={planExpiresAt} onChange={(event) => setPlanExpiresAt(event.target.value)} type="datetime-local" style={fieldStyle} />
        <input value={referralPercent} onChange={(event) => setReferralPercent(event.target.value)} placeholder="Индив. referral %" style={fieldStyle} />
        <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Причина изменения" style={fieldStyle} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="button-primary"
            type="button"
            onClick={() =>
              void onSave(String(user.id), {
                name,
                role,
                plan,
                billingPlanId: billingPlanId || null,
                tokenBalance: Number(tokenBalance || 0),
                planExpiresAt: planExpiresAt ? new Date(planExpiresAt).toISOString() : null,
                referralRewardPercentOverride: referralPercent ? Number(referralPercent) : null,
                reason
              })
            }
          >
            Сохранить профиль
          </button>
          <button
            className="button-secondary"
            type="button"
            onClick={() =>
              void onSave(String(user.id), {
                tokenDelta: Number(tokenDelta || 0),
                reason
              })
            }
          >
            Применить дельту
          </button>
        </div>
      </div>
    </div>
  );
}

function PlanEditor({
  plan,
  onSave,
  onDelete
}: {
  plan: BillingPlan;
  onSave: (id: string, payload: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    code: String(plan.code || ""),
    name: String(plan.name || ""),
    basePlan: String(plan.basePlan || "BASE"),
    priceRub: String(plan.priceRub || 0),
    tokensPerMonth: String(plan.tokensPerMonth || 0),
    requestsPerHour: String(plan.requestsPerHour || 0),
    description: String(plan.description || ""),
    features: Array.isArray(plan.features) ? plan.features.join("\n") : "",
    sortOrder: String(plan.sortOrder || 0),
    isActive: Boolean(plan.isActive),
    isPublic: Boolean(plan.isPublic)
  });

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <input value={draft.code} onChange={(event) => setDraft((prev) => ({ ...prev, code: event.target.value }))} placeholder="Код" style={fieldStyle} />
        <input value={draft.name} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} placeholder="Название" style={fieldStyle} />
        <select value={draft.basePlan} onChange={(event) => setDraft((prev) => ({ ...prev, basePlan: event.target.value }))} style={fieldStyle}>
          {["FREE", "BASE", "PRO", "ULTRA", "BUSINESS"].map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <input value={draft.priceRub} onChange={(event) => setDraft((prev) => ({ ...prev, priceRub: event.target.value }))} placeholder="Цена ₽" style={fieldStyle} />
        <input value={draft.tokensPerMonth} onChange={(event) => setDraft((prev) => ({ ...prev, tokensPerMonth: event.target.value }))} placeholder="Токены / месяц" style={fieldStyle} />
        <input value={draft.requestsPerHour} onChange={(event) => setDraft((prev) => ({ ...prev, requestsPerHour: event.target.value }))} placeholder="Запросы / час" style={fieldStyle} />
        <input value={draft.sortOrder} onChange={(event) => setDraft((prev) => ({ ...prev, sortOrder: event.target.value }))} placeholder="Порядок сортировки" style={fieldStyle} />
        <textarea value={draft.description} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} placeholder="Описание" style={areaStyle} />
        <textarea value={draft.features} onChange={(event) => setDraft((prev) => ({ ...prev, features: event.target.value }))} placeholder="Фичи, по одной в строке" style={areaStyle} />
        <label className="muted"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft((prev) => ({ ...prev, isActive: event.target.checked }))} /> Активен</label>
        <label className="muted"><input type="checkbox" checked={draft.isPublic} onChange={(event) => setDraft((prev) => ({ ...prev, isPublic: event.target.checked }))} /> Публичный</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="button-primary"
            type="button"
            onClick={() =>
              void onSave(String(plan.id), {
                ...draft,
                code: draft.code.toUpperCase(),
                priceRub: Number(draft.priceRub),
                tokensPerMonth: Number(draft.tokensPerMonth),
                requestsPerHour: Number(draft.requestsPerHour),
                sortOrder: Number(draft.sortOrder),
                features: draft.features.split("\n").map((entry) => entry.trim()).filter(Boolean)
              })
            }
          >
            Сохранить
          </button>
          <button className="button-secondary" type="button" onClick={() => void onDelete(String(plan.id))}>
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}

function PromoEditor({
  promo,
  plans,
  onSave,
  onDelete
}: {
  promo: PromoCode;
  plans: BillingPlan[];
  onSave: (id: string, payload: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    code: String(promo.code || ""),
    description: String(promo.description || ""),
    billingPlanId: String((promo.billingPlan as Record<string, unknown> | null)?.id || ""),
    discountPercent: String(promo.discountPercent || 0),
    bonusTokens: String(promo.bonusTokens || 0),
    referralPercent: promo.referralPercent == null ? "" : String(promo.referralPercent),
    maxUses: promo.maxUses == null ? "" : String(promo.maxUses),
    expiresAt: toInputDateTimeValue(promo.expiresAt),
    isActive: Boolean(promo.isActive)
  });

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="muted" style={{ marginBottom: 8 }}>Использовано: {String(promo.usedCount || 0)}</div>
      <div style={{ display: "grid", gap: 8 }}>
        <input value={draft.code} onChange={(event) => setDraft((prev) => ({ ...prev, code: event.target.value }))} placeholder="Код" style={fieldStyle} />
        <input value={draft.description} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} placeholder="Описание" style={fieldStyle} />
        <select value={draft.billingPlanId} onChange={(event) => setDraft((prev) => ({ ...prev, billingPlanId: event.target.value }))} style={fieldStyle}>
          <option value="">Любой тариф</option>
          {plans.map((entry) => <option key={String(entry.id)} value={String(entry.id)}>{String(entry.name)}</option>)}
        </select>
        <input value={draft.discountPercent} onChange={(event) => setDraft((prev) => ({ ...prev, discountPercent: event.target.value }))} placeholder="Скидка %" style={fieldStyle} />
        <input value={draft.bonusTokens} onChange={(event) => setDraft((prev) => ({ ...prev, bonusTokens: event.target.value }))} placeholder="Бонус токены" style={fieldStyle} />
        <input value={draft.referralPercent} onChange={(event) => setDraft((prev) => ({ ...prev, referralPercent: event.target.value }))} placeholder="Реферальный %" style={fieldStyle} />
        <input value={draft.maxUses} onChange={(event) => setDraft((prev) => ({ ...prev, maxUses: event.target.value }))} placeholder="Максимум использований" style={fieldStyle} />
        <input value={draft.expiresAt} onChange={(event) => setDraft((prev) => ({ ...prev, expiresAt: event.target.value }))} type="datetime-local" style={fieldStyle} />
        <label className="muted"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft((prev) => ({ ...prev, isActive: event.target.checked }))} /> Активен</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="button-primary"
            type="button"
            onClick={() =>
              void onSave(String(promo.id), {
                ...draft,
                code: draft.code.toUpperCase(),
                billingPlanId: draft.billingPlanId || null,
                discountPercent: Number(draft.discountPercent),
                bonusTokens: Number(draft.bonusTokens),
                referralPercent: draft.referralPercent ? Number(draft.referralPercent) : null,
                maxUses: draft.maxUses ? Number(draft.maxUses) : null,
                expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null
              })
            }
          >
            Сохранить
          </button>
          <button className="button-secondary" type="button" onClick={() => void onDelete(String(promo.id))}>
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}

function ReferralRewardEditor({
  reward,
  onSave
}: {
  reward: ReferralReward;
  onSave: (id: string, status: string) => Promise<void>;
}) {
  const [status, setStatus] = useState(String(reward.status || "PENDING"));

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontWeight: 700 }}>
        {String((reward.referrer as Record<string, unknown> | null)?.email || "...")} ←{" "}
        {String((reward.referee as Record<string, unknown> | null)?.email || "...")}
      </div>
      <div className="muted" style={{ marginTop: 4 }}>
        {String(reward.amountRub)} ₽ · {String(reward.rewardPercent)}% · {formatDateTime(reward.createdAt)}
      </div>
      <div className="muted" style={{ marginTop: 4 }}>
        Платеж: {String((reward.payment as Record<string, unknown> | null)?.amount || 0)} ₽ · {String((reward.payment as Record<string, unknown> | null)?.status || "—")}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <select value={status} onChange={(event) => setStatus(event.target.value)} style={{ ...fieldStyle, width: 180 }}>
          {["PENDING", "APPROVED", "PAID", "CANCELLED"].map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <button className="button-primary" type="button" onClick={() => void onSave(String(reward.id), status)}>
          Сохранить статус
        </button>
      </div>
    </div>
  );
}

function ModelEditor({
  model,
  onSave
}: {
  model: Record<string, unknown>;
  onSave: (id: string, payload: Record<string, unknown>) => Promise<void>;
}) {
  const [isEnabled, setIsEnabled] = useState(Boolean(model.isEnabled));
  const [minPlan, setMinPlan] = useState(String(model.minPlan || "FREE"));
  const [maxTokens, setMaxTokens] = useState(String(model.maxTokens || 4096));

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontWeight: 700 }}>{String(model.displayName)}</div>
      <div className="muted" style={{ marginTop: 4 }}>{String(model.id)}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        <label className="muted">
          <input type="checkbox" checked={isEnabled} onChange={(event) => setIsEnabled(event.target.checked)} /> enabled
        </label>
        <select value={minPlan} onChange={(event) => setMinPlan(event.target.value)} style={{ ...fieldStyle, width: 160 }}>
          {["FREE", "BASE", "PRO", "ULTRA", "BUSINESS"].map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <input value={maxTokens} onChange={(event) => setMaxTokens(event.target.value)} style={{ ...fieldStyle, width: 160 }} />
        <button className="button-primary" type="button" onClick={() => void onSave(String(model.id), { isEnabled, minPlan, maxTokens: Number(maxTokens) })}>
          Сохранить
        </button>
      </div>
    </div>
  );
}
