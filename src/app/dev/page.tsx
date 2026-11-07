"use client";
import { useEffect, useState } from "react";

type Purchase = { id: string; total: number; orderId: string; captureId?: string; refunded?: unknown; items: { name: string }[] };

export default function Dev() {
  const [state, setState] = useState<{ walletSaved: boolean; purchases: Purchase[] } | null>(null);
  const [log, setLog] = useState("");
  const refresh = () => fetch("/api/state").then((r) => r.json()).then(setState);
  useEffect(() => { refresh(); }, []);

  const post = async (url: string, body?: unknown) => {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json();
    setLog(JSON.stringify(j, null, 2));
    refresh();
    return j;
  };

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Mandate: PayPal money-flow test</h1>
      <p>Wallet saved: <b>{state?.walletSaved ? "yes" : "no"}</b></p>
      <div className="flex gap-2 flex-wrap">
        <button className="rounded bg-blue-600 px-3 py-2 text-white" onClick={async () => {
          const j = await post("/api/paypal/vault/setup");
          if (j.approveUrl) window.location.href = j.approveUrl;
        }}>1. Save sandbox PayPal wallet</button>
        <button className="rounded bg-blue-600 px-3 py-2 text-white" onClick={() => post("/api/paypal/vault/test-card")}>1b. Save sandbox test card instead</button>
        <button className="rounded bg-blue-600 px-3 py-2 text-white" onClick={() => post("/api/paypal/test-order")}>2. Charge $8.99 test order</button>
      </div>
      <ul className="space-y-2">
        {state?.purchases.map((p) => (
          <li key={p.id} className="rounded border p-3 flex justify-between items-center">
            <span>{p.items[0]?.name} · ${p.total.toFixed(2)} · {p.refunded ? "refunded" : "paid"}</span>
            {!p.refunded && <button className="rounded border px-2 py-1" onClick={() => post("/api/paypal/refund", { purchaseId: p.id })}>3. Refund</button>}
          </li>
        ))}
      </ul>
      <pre className="whitespace-pre-wrap rounded bg-neutral-100 p-3 text-xs text-black">{log}</pre>
    </main>
  );
}
