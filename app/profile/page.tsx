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
    void (async () => {
      const [profileResponse, statsResponse] = await Promise.all([fetch("/api/user/profile"), fetch("/api/user/stats")]);
      const profilePayload = await profileResponse.json();
      const statsPayload = await statsResponse.json();
      if (profileResponse.ok) {
        setProfile(profilePayload.user);
        setPayments(profilePayload.payments || []);
        setReferral(profilePayload.referral || null);
        setName(profilePayload.user.name || "");
      }
      if (statsResponse.ok) {
        setStats(statsPayload.stats);
      }
    })();
  }, []);

  useEffect(() => {
    const refresh = async () => {
      const response = await fetch("/api/user/profile");
      const payload = await response.json();
      if (response.ok && payload.user) {
        setProfile(payload.user);
        setPayments(payload.payments || []);
        setReferral(payload.referral || null);
        setName(payload.user.name || "");
      }
    };

    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const referralLink = useMemo(() => {
    if (!profile || !referral?.referralCode || typeof window === "undefined") return "";
    return `${window.location.origin}/auth/register?ref=${String(referral.referralCode)}`;
  }, [profile, referral]);

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
      setMessage(payload.message || "Не удалось сохранить изменения");
      return;
    }
    setProfile(payload.user);
    setMessage("Профиль обновлён");
  }

  async function copyReferralLink() {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setMessage("Ссылка скопирована");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
    router.refresh();
  }

  const recentReferrals = Array.isArray(referral?.recentReferrals) ? referral.recentReferrals : [];
  const recentRewards = Array.isArray(referral?.recentRewards) ? referral.recentRewards : [];

  return (
    <div className="page-stack">
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button
          className="button-secondary compact-button"
          type="button"
          onClick={() => void logout()}
          style={{ color: "var(--error)" }}
        >
          ↩ Выйти из аккаунта
        </button>
      </div>
      <section className="surface">
        <div className="eyebrow">Аккаунт</div>
        <h1 className="surface-title">Управляйте профилем, подпиской, балансом и реферальной ссылкой.</h1>
        <p className="surface-copy">Все ключевые данные собраны на одном экране без лишних служебных деталей.</p>
      </section>

      <div className="grid-4">
        {[
          ["Баланс", null],
          ["Тариф", null],
          ["Действует до", profile?.planExpiresAt ? new Date(profile.planExpiresAt).toLocaleDateString("ru-RU") : "Без срока"],
          ["Всего сообщений", String(stats?.totalMessages ?? "—")]
        ].map(([label, value]) => (
          <section key={label} className="surface">
            <div className="eyebrow">{label}</div>
            {label === "Баланс" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: "var(--brand-cyan)" }}>
                  {profile ? (profile.tokenBalance / 1_000_000).toFixed(2) : "0.00"}M
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {profile ? profile.tokenBalance.toLocaleString("ru-RU") : "0"} токенов
                </span>
                {profile && profile.tokenBalance < 100_000 && (
                  <a href="/rates" className="button-primary compact-button" style={{ width: "fit-content" }}>
                    Пополнить баланс →
                  </a>
                )}
              </div>
            ) : label === "Тариф" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div className="surface-title" style={{ fontSize: "32px" }}>{profile?.plan || "—"}</div>
                {profile?.planExpiresAt && (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    до {new Date(profile.planExpiresAt).toLocaleDateString("ru-RU", {
                      day: "numeric", month: "long", year: "numeric"
                    })}
                  </span>
                )}
              </div>
            ) : (
              <div className="surface-title" style={{ fontSize: "32px" }}>{value}</div>
            )}
          </section>
        ))}
      </div>

      <div className="content-grid two-columns">
        <section className="surface">
          <div className="eyebrow">Профиль</div>
          <h2 className="surface-title">Основные данные</h2>
          <form onSubmit={save} className="section-stack">
            <label className="field">
              <span>Имя</span>
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <div className="feature-list">
              <div className="feature-row">
                <strong>Email</strong>
                <span>{profile?.email || "—"}</span>
              </div>
              <div className="feature-row">
                <strong>Статус</strong>
                <span>{profile?.role === "ADMIN" ? "Администратор" : "Аккаунт активен"}</span>
              </div>
            </div>
            {message ? <div className="success-banner">{message}</div> : null}
            <div className="toolbar-row">
              <button className="button-primary" type="submit">
                Сохранить
              </button>
            </div>
          </form>
        </section>

        <section className="surface">
          <div className="eyebrow">Рекомендации и рефералы</div>
          <h2 className="surface-title">Приглашайте по ссылке</h2>
          <div className="feature-list">
            <div className="feature-row">
              <strong>Код</strong>
              <span>{String(referral?.referralCode ?? "—")}</span>
            </div>
            <div className="feature-row">
              <strong>Ссылка</strong>
              <span>{referralLink || "Появится после загрузки профиля"}</span>
            </div>
            <div className="feature-row">
              <strong>Приглашено</strong>
              <span>{String(referral?.referralsCount ?? 0)}</span>
            </div>
            <div className="feature-row">
              <strong>Начислено</strong>
              <span>{String(referral?.rewardAmountRub ?? 0)} ₽</span>
            </div>
          </div>
          <button className="button-primary" type="button" onClick={() => void copyReferralLink()} style={{ marginTop: 16 }}>
            Скопировать ссылку
          </button>
        </section>
      </div>

      <div className="content-grid two-columns">
        <section className="surface">
          <div className="eyebrow">Платежи</div>
          <h2 className="surface-title">Последние пополнения</h2>
          <div className="status-list">
            {payments.slice(0, 8).map((payment) => (
              <div key={String(payment.id)} className="status-card">
                <strong>{String(payment.description)}</strong>
                <span className="muted-text">{String(payment.amount)} ₽ · {String(payment.status)}</span>
              </div>
            ))}
            {payments.length === 0 ? <div className="muted-text">История платежей пока пуста.</div> : null}
          </div>
        </section>

        <section className="surface">
          <div className="eyebrow">Последние активности</div>
          <h2 className="surface-title">Приглашения и начисления</h2>
          <div className="status-list">
            {recentReferrals.map((entry) => (
              <div key={String((entry as Record<string, unknown>).id)} className="status-card">
                <strong>{String((entry as Record<string, unknown>).email || "Пользователь")}</strong>
                <span className="muted-text">{new Date(String((entry as Record<string, unknown>).createdAt || "")).toLocaleString("ru-RU")}</span>
              </div>
            ))}
            {recentRewards.map((entry) => (
              <div key={String((entry as Record<string, unknown>).id)} className="status-card">
                <strong>{String(((entry as Record<string, unknown>).referee as Record<string, unknown> | null)?.email || "Начисление")}</strong>
                <span className="muted-text">{String((entry as Record<string, unknown>).amountRub || 0)} ₽ · {String((entry as Record<string, unknown>).status || "")}</span>
              </div>
            ))}
            {recentReferrals.length === 0 && recentRewards.length === 0 ? <div className="muted-text">Пока здесь нет активности.</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
