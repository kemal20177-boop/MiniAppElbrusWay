"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("paymentId");
  const [status, setStatus] = useState("Проверяем статус платежа...");

  useEffect(() => {
    if (!paymentId) {
      setStatus("Платежная страница закрыта. Если токены еще не начислены, откройте кабинет позже.");
      return;
    }

    let cancelled = false;

    async function pollStatus() {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await fetch(`/api/payments/${paymentId}/status`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          setStatus(payload.message || "Не удалось проверить статус платежа.");
          return;
        }

        const paymentStatus = String(payload.payment?.status || "PENDING");
        if (paymentStatus === "SUCCEEDED") {
          if (!cancelled) {
            setStatus("Платеж подтвержден, токены уже начислены на баланс.");
            window.dispatchEvent(new Event("elbrusway:balance-changed"));
          }
          return;
        }

        if (paymentStatus === "CANCELLED" || paymentStatus === "FAILED" || paymentStatus === "REFUNDED") {
          if (!cancelled) {
            setStatus(`Платеж завершился со статусом ${paymentStatus}.`);
          }
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      if (!cancelled) {
        setStatus("Платеж создан. Подтверждение еще не пришло, обновите страницу через несколько секунд.");
      }
    }

    void pollStatus();

    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  return (
    <main className="shell" style={{ padding: "18px 0 56px" }}>
      <section className="panel" style={{ padding: 28, maxWidth: 720, margin: "0 auto" }}>
        <div className="badge">Оплата</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Оплата прошла успешно</h1>
        <p className="section-copy">{status}</p>
      </section>
    </main>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="shell" style={{ padding: "18px 0 56px" }}>
          <section className="panel" style={{ padding: 28, maxWidth: 720, margin: "0 auto" }}>
            <div className="badge">Оплата</div>
            <h1 className="section-title" style={{ marginTop: 16 }}>Оплата прошла успешно</h1>
            <p className="section-copy">Проверяем статус платежа...</p>
          </section>
        </main>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
