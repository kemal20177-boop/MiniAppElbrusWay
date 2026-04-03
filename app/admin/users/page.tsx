"use client";

import { FormEvent, useEffect, useState } from "react";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  tokenBalance: number;
  planExpiresAt: string | null;
  createdAt: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [grantTokens, setGrantTokens] = useState(40_000_000);
  const [grantPlan, setGrantPlan] = useState("PRO");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (res.ok) setUsers(data.data?.users || data.users || []);
  }

  async function handleGrant(event: FormEvent) {
    event.preventDefault();
    if (!selectedUser) return;

    setLoading(true);
    setMessage("");
    setError("");

    const res = await fetch("/api/admin/grant-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: selectedUser.id,
        tokens: grantTokens,
        plan: grantPlan,
        reason: `Ручная корректировка от ${new Date().toLocaleDateString("ru-RU")}`
      })
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setMessage(`✅ Начислено ${grantTokens.toLocaleString()} токенов. Тариф: ${grantPlan}`);
      await loadUsers();
    } else {
      setError(`❌ Ошибка: ${data.message}`);
    }
  }

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-stack">
      <section className="surface">
        <div className="eyebrow">Администрирование</div>
        <h1 className="surface-title">Управление пользователями и балансами</h1>
      </section>

      <div className="content-grid two-columns">
        <section className="surface">
          <h2 className="surface-title" style={{ fontSize: 16 }}>Пользователи</h2>
          <input
            type="text"
            placeholder="Поиск по email или имени..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "60vh", overflowY: "auto" }}>
            {filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                className={selectedUser?.id === u.id ? "chat-list-card active" : "chat-list-card"}
                onClick={() => setSelectedUser(u)}
              >
                <div className="chat-item-title">{u.email}</div>
                <div className="chat-item-copy">
                  {u.plan} · {(u.tokenBalance / 1_000_000).toFixed(2)}M токенов
                  {u.planExpiresAt && ` · до ${new Date(u.planExpiresAt).toLocaleDateString("ru-RU")}`}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="muted-text">Пользователи не найдены</div>
            )}
          </div>
        </section>

        <section className="surface">
          {selectedUser ? (
            <div className="section-stack">
              <div>
                <div className="eyebrow">Выбран пользователь</div>
                <h2 className="surface-title" style={{ fontSize: 16 }}>{selectedUser.email}</h2>
                <p className="surface-copy">
                  Текущий тариф: <strong>{selectedUser.plan}</strong><br />
                  Баланс: <strong>{selectedUser.tokenBalance.toLocaleString()} токенов</strong><br />
                  {selectedUser.planExpiresAt && (
                    <>Тариф до: <strong>{new Date(selectedUser.planExpiresAt).toLocaleDateString("ru-RU")}</strong></>
                  )}
                </p>
              </div>

              <form onSubmit={handleGrant} className="section-stack">
                <label className="field">
                  <span>Начислить токенов</span>
                  <input
                    type="number"
                    value={grantTokens}
                    onChange={(e) => setGrantTokens(Number(e.target.value))}
                    min={0}
                  />
                </label>

                <label className="field">
                  <span>Установить тариф</span>
                  <select value={grantPlan} onChange={(e) => setGrantPlan(e.target.value)}>
                    <option value="FREE">Free — 0 ₽</option>
                    <option value="BASE">Base — 490 ₽/мес</option>
                    <option value="PRO">Pro — 990 ₽/мес (40M токенов)</option>
                    <option value="ULTRA">Ultra — 1990 ₽/мес (100M токенов)</option>
                    <option value="BUSINESS">Business — 9900 ₽/мес</option>
                  </select>
                </label>

                <div className="toggle-row">
                  <button type="button" className="chip"
                    onClick={() => { setGrantTokens(40_000_000); setGrantPlan("PRO"); }}>
                    PRO пресет
                  </button>
                  <button type="button" className="chip"
                    onClick={() => { setGrantTokens(100_000_000); setGrantPlan("ULTRA"); }}>
                    Ultra пресет
                  </button>
                  <button type="button" className="chip"
                    onClick={() => { setGrantTokens(50_000); setGrantPlan("FREE"); }}>
                    Free сброс
                  </button>
                </div>

                {error && <div className="error-banner">{error}</div>}
                {message && <div className="success-banner">{message}</div>}

                <button type="submit" className="button-primary" disabled={loading}>
                  {loading ? "Начисляем..." : "Начислить токены и установить тариф"}
                </button>
              </form>
            </div>
          ) : (
            <div className="muted-text" style={{ padding: "40px 0", textAlign: "center" }}>
              Выберите пользователя из списка слева
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
