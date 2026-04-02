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
      <div className="auth-layout">
        <div className="auth-intro surface">
          <div className="eyebrow">Вход</div>
          <h1 className="auth-title">Вернитесь в рабочий кабинет без лишних шагов.</h1>
          <p className="auth-copy">После входа вы попадаете сразу в спокойный стартовый экран чата: модель, сообщение и только потом дополнительные панели.</p>
          <div className="feature-list">
            <div className="feature-row">
              <strong>Чат как главный сценарий</strong>
              <span>Первый экран не перегружает историей, файлами и настройками одновременно.</span>
            </div>
            <div className="feature-row">
              <strong>Понятный выбор модели</strong>
              <span>Вкладки по знакомым названиям вместо длинного технического списка.</span>
            </div>
            <div className="feature-row">
              <strong>Медиа и документы рядом</strong>
              <span>Изображения, аудио, video planning и рабочие материалы открываются из одного кабинета.</span>
            </div>
          </div>
        </div>

        <div className="auth-card">
          <div className="eyebrow">Аккаунт</div>
          <h2 className="surface-title">Войти</h2>
          <form onSubmit={onSubmit} className="auth-form">
            <label className="field">
              <span>Email</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" />
            </label>
            <label className="field">
              <span>Пароль</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Введите пароль"
                autoComplete="current-password"
              />
            </label>
            {error ? <div className="error-banner">{error}</div> : null}
            <button className="button-primary auth-submit" type="submit" disabled={loading}>
              {loading ? "Входим..." : "Продолжить"}
            </button>
          </form>

          <div className="auth-footer">
            <span>Ещё нет аккаунта?</span>
            <Link href="/auth/register">Создать аккаунт</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
