"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type UserProfile = {
  id: string;
  email: string;
  name: string;
  role: string;
  plan: string;
  tokenBalance: number;
  planExpiresAt: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [payments, setPayments] = useState<Array<Record<string, unknown>>>([]);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [referral, setReferral] = useState<Record<string, unknown> | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void load();
  }, []);

  const referralLink = useMemo(() => {
    if (!profile || !referral?.referralCode || typeof window === "undefined") {
      return "";
    }

    return `${window.location.origin}/auth/register?ref=${String(referral.referralCode)}`;
  }, [profile, referral]);

  async function load() {
    const [profileResponse, statsResponse] = await Promise.all([
      fetch("/api/user/profile"),
      fetch("/api/user/stats")
    ]);

    const profilePayload = await profileResponse.json();
    if (profileResponse.ok) {
      setProfile(profilePayload.user);
      setPayments(profilePayload.payments || []);
      setReferral(profilePayload.referral || null);
      setName(profilePayload.user.name || "");
    }

    const statsPayload = await statsResponse.json();
    if (statsResponse.ok) {
      setStats(statsPayload.stats);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.message || "Не удалось сохранить профиль");
      return;
    }

    setProfile(payload.user);
    setMessage("Профиль обновлён");
  }

  async function copyReferralLink() {
    if (!referralLink) {
      return;
    }

    await navigator.clipboard.writeText(referralLink);
    setMessage("Реферальная ссылка скопирована");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
    router.refresh();
  }

  const recentReferrals = Array.isArray(referral?.recentReferrals) ? referral.recentReferrals : [];
  const recentRewards = Array.isArray(referral?.recentRewards) ? referral.recentRewards : [];

  return (
    <main className="shell" style={{ padding: "18px 0 56px" }}>
      <section className="panel" style={{ padding: 28 }}>
        <div className="badge">Кабинет</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Центр аккаунта</h1>
        <div className="grid-4" style={{ marginTop: 24 }}>
          {[
            ["Баланс", String(profile?.tokenBalance ?? "...")],
            ["Тариф", profile?.plan || "..."],
            ["До", profile?.planExpiresAt ? new Date(profile.planExpiresAt).toLocaleDateString("ru-RU") : "без срока"],
            ["Роль", profile?.role || "..."]
          ].map(([label, value]) => (
            <div key={label} className="card">
              <div className="muted">{label}</div>
              <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800 }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="grid-3" style={{ marginTop: 24 }}>
          <form className="card" onSubmit={save}>
            <h2 style={{ marginTop: 0 }}>Настройки</h2>
            <div className="muted" style={{ marginBottom: 12 }}>Обновление имени хранится на сервере.</div>
            <input value={name} onChange={(event) => setName(event.target.value)} style={fieldStyle} />
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button className="button-primary" type="submit">Сохранить</button>
              <button className="button-ghost" type="button" onClick={() => void logout()}>Выйти</button>
            </div>
            {message ? <div style={{ marginTop: 10 }}>{message}</div> : null}
          </form>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Использование</h2>
            <div className="muted">Всего сообщений: {String(stats?.totalMessages ?? "...")}</div>
            <div className="muted">Токенов израсходовано: {String(stats?.totalTokens ?? "...")}</div>
            <div className="muted">Себестоимость RouterAI: {String(stats?.totalCostRub ?? "...")} ₽</div>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>История платежей</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {payments.slice(0, 5).map((payment) => (
                <div key={String(payment.id)} className="muted">
                  {String(payment.description)} · {String(payment.amount)} ₽ · {String(payment.status)}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid-3" style={{ marginTop: 24 }}>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Реферальная программа</h2>
            <div className="muted">Код: {String(referral?.referralCode ?? "...")}</div>
            <div className="muted">Ссылка: {referralLink || "..."}</div>
            <div className="muted">Рефералов: {String(referral?.referralsCount ?? 0)}</div>
            <div className="muted">Вознаграждений: {String(referral?.rewardsCount ?? 0)}</div>
            <div className="muted">Сумма: {String(referral?.rewardAmountRub ?? 0)} ₽</div>
            <div className="muted">Ставка: {String(referral?.rewardPercent ?? 0)}%</div>
            <div className="muted">Бонус новичку: {String(referral?.refereeBonusTokens ?? 0)} токенов</div>
            <button className="button-primary" style={{ marginTop: 14 }} type="button" onClick={() => void copyReferralLink()}>
              Скопировать ссылку
            </button>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Последние регистрации</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {recentReferrals.length === 0 ? <div className="muted">Пока нет рефералов</div> : null}
              {recentReferrals.map((entry) => (
                <div key={String((entry as Record<string, unknown>).id)} className="muted">
                  {String((entry as Record<string, unknown>).email || "...")} ·{" "}
                  {new Date(String((entry as Record<string, unknown>).createdAt || "")).toLocaleString("ru-RU")}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Последние начисления</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {recentRewards.length === 0 ? <div className="muted">Пока нет начислений</div> : null}
              {recentRewards.map((entry) => (
                <div key={String((entry as Record<string, unknown>).id)} className="muted">
                  {String(((entry as Record<string, unknown>).referee as Record<string, unknown> | null)?.email || "...")} ·{" "}
                  {String((entry as Record<string, unknown>).amountRub || 0)} ₽ · {String((entry as Record<string, unknown>).status || "...")}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

const fieldStyle = {
  width: "100%",
  minHeight: 48,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-primary)",
  padding: "0 14px"
} as const;
