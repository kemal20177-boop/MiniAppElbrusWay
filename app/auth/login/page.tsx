"use client";

import Link from "next/link";
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

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const payload = await response.json();

    setLoading(false);
    if (!response.ok) {
      setError(payload.message || "Не удалось войти");
      return;
    }

    router.push("/chat");
    router.refresh();
  }

  return (
    <section className="auth-shell">
      <div className="auth-card">
        <div className="eyebrow">Вход</div>
        <h1 className="auth-title">Продолжить работу в ElbrusWay AI</h1>
        <p className="auth-copy">Войдите в аккаунт, чтобы открыть чат, файлы, документы и медиа-инструменты.</p>

        <form onSubmit={onSubmit} className="auth-form">
          <label className="field">
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          </label>
          <label className="field">
            <span>Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Введите пароль"
            />
          </label>
          {error ? <div className="error-banner">{error}</div> : null}
          <button className="button-primary auth-submit" type="submit" disabled={loading}>
            {loading ? "Входим..." : "Войти"}
          </button>
        </form>

        <div className="auth-footer">
          <span>Ещё нет аккаунта?</span>
          <Link href="/auth/register">Создать аккаунт</Link>
        </div>
      </div>
    </section>
  );
}
