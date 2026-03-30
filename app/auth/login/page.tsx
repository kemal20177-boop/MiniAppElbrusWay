"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Не удалось войти");
      }

      router.push("/chat");
      router.refresh();
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell" style={{ padding: "18px 0 56px" }}>
      <section className="panel" style={{ padding: 28, maxWidth: 560, margin: "0 auto" }}>
        <div className="badge">Auth</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Вход</h1>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 14, marginTop: 24 }}>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" style={fieldStyle} />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Пароль"
            type="password"
            style={fieldStyle}
          />
          <button className="button-primary" type="submit" disabled={loading}>
            {loading ? "Входим..." : "Войти"}
          </button>
          <div className="muted" style={{ fontSize: 14 }}>
            Если это первый вход, сначала зарегистрируйтесь. Администратор создаётся по `ADMIN_EMAIL`, но пароль ему
            нужно назначить через JSON store или отдельный flow.
          </div>
          {error ? <div style={{ color: "var(--error)" }}>{error}</div> : null}
        </form>
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
