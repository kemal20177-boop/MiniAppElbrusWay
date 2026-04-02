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
      <div className="auth-card">
        <div className="eyebrow">Регистрация</div>
        <h1 className="auth-title">Создать аккаунт и начать с первого запроса</h1>
        <p className="auth-copy">После регистрации вы сразу попадёте в чат и сможете выбрать удобную модель для старта.</p>

        <form onSubmit={onSubmit} className="auth-form">
          <label className="field">
            <span>Имя</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Как к вам обращаться" />
          </label>
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
              placeholder="Минимум 8 символов"
            />
          </label>
          <label className="field">
            <span>Повторите пароль</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Повторите пароль"
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
            {loading ? "Создаём аккаунт..." : "Создать аккаунт"}
          </button>
        </form>

        <div className="auth-footer">
          <span>Уже есть аккаунт?</span>
          <Link href="/auth/login">Войти</Link>
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
