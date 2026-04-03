"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      setReferralCode(ref.toUpperCase());
    }
  }, [searchParams]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        confirmPassword,
        referralCode: referralCode || undefined
      })
    });
    const payload = await response.json();

    setLoading(false);
    if (!response.ok) {
      setError(payload.message || "Регистрация не удалась");
      return;
    }

    router.push("/chat");
    router.refresh();
  }

  return (
    <section className="auth-shell">
      <div className="auth-layout">
        <div className="auth-intro surface">
          <div className="eyebrow">Регистрация</div>
          <h1 className="auth-title">Создайте аккаунт и начните с первого сообщения.</h1>
          <p className="auth-copy">После регистрации вы сразу попадаете в новый chat start screen с понятным выбором модели и мягким рабочим интерфейсом.</p>
          <div className="feature-list">
            <div className="feature-row">
              <strong>Один понятный вход</strong>
              <span>Сначала сообщение и модель, а не россыпь вторичных панелей.</span>
            </div>
            <div className="feature-row">
              <strong>Отдельные сценарии для медиа</strong>
              <span>Изображения, аудио и video planning вынесены в понятные рабочие разделы.</span>
            </div>
            <div className="feature-row">
              <strong>Проекты, файлы и документы сохраняются рядом</strong>
              <span>Ничего не теряется между чатом и рабочими артефактами.</span>
            </div>
          </div>
        </div>

        <div className="auth-card">
          <div className="eyebrow">Новый аккаунт</div>
          <h2 className="surface-title">Создать аккаунт</h2>
          <form onSubmit={onSubmit} className="auth-form">
            <label className="field">
              <span>Имя</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Как к вам обращаться" autoComplete="name" />
            </label>
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
                placeholder="Минимум 8 символов"
                autoComplete="new-password"
              />
            </label>
            <label className="field">
              <span>Повторите пароль</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Повторите пароль"
                autoComplete="new-password"
              />
            </label>
            <label className="field">
              <span>Реферальный код</span>
              <input
                value={referralCode}
                onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
                placeholder="Если есть"
              />
            </label>
            {error ? <div className="error-banner">{error}</div> : null}
            <button className="button-primary auth-submit" type="submit" disabled={loading}>
              {loading ? "Создаём аккаунт..." : "Создать и открыть чат"}
            </button>
          </form>

          <div className="auth-footer">
            <span>Уже есть аккаунт?</span>
            <Link href="/auth/login">Войти</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<section className="auth-shell" />}>
      <RegisterForm />
    </Suspense>
  );
}
