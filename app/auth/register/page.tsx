"use client";

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
      setReferralCode(ref);
    }
  }, [searchParams]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, confirmPassword, referralCode: referralCode || undefined })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Регистрация не удалась");
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
        <h1 className="section-title" style={{ marginTop: 16 }}>Регистрация</h1>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 14, marginTop: 24 }}>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Имя" style={fieldStyle} />
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" style={fieldStyle} />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Пароль"
            type="password"
            style={fieldStyle}
          />
          <input
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Повторите пароль"
            type="password"
            style={fieldStyle}
          />
          <input
            value={referralCode}
            onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
            placeholder="Реферальный код"
            style={fieldStyle}
          />
          <button className="button-primary" type="submit" disabled={loading}>
            {loading ? "Создаём..." : "Создать аккаунт"}
          </button>
          {error ? <div style={{ color: "var(--error)" }}>{error}</div> : null}
        </form>
      </section>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="shell" style={{ padding: "18px 0 56px" }} />}>
      <RegisterForm />
    </Suspense>
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
