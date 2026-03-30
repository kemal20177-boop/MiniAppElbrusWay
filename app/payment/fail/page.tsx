export default function PaymentFailPage() {
  return (
    <main className="shell" style={{ padding: "18px 0 56px" }}>
      <section className="panel" style={{ padding: 28, maxWidth: 720, margin: "0 auto" }}>
        <div className="badge">Оплата</div>
        <h1 className="section-title" style={{ marginTop: 16 }}>Оплата не завершена</h1>
        <p className="section-copy">
          Платеж не был подтвержден. Можно вернуться к тарифам и создать новую ссылку оплаты через Platega.
        </p>
      </section>
    </main>
  );
}
