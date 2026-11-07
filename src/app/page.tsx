"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Item = { name: string; merchant?: string; unitAmount: number; quantity: number };
type Purchase = {
  id: string; createdAt: string; items: Item[]; total: number; orderId: string;
  explanation: string; rule?: string; refunded?: { amount: number; reason?: string };
};
type Approval = { id: string; cart: Item[]; total: number; explanation: string; reasons: string[]; status: string };
type Mandate = {
  name: string; budget: number; period: string; approvalThreshold: number; maxItemPrice?: number;
  allowedCategories: string[]; allowedMerchants: string[]; blockedKeywords: string[];
};
type Feed =
  | { kind: "user" | "agent"; text: string; at: string }
  | { kind: "purchase" | "refund"; purchaseId: string; at: string }
  | { kind: "approval"; approvalId: string; at: string }
  | { kind: "denied"; reasons: string[]; total: number; at: string }
  | { kind: "mandate"; at: string };
type State = {
  walletSaved: boolean; walletKind: "paypal" | "card" | null; paypalConfigured: boolean; mandate: Mandate | null; spent: number;
  purchases: Purchase[]; approvals: Approval[]; feed: Feed[];
};

const usd = (n: number) => `$${n.toFixed(2)}`;
const SUGGESTIONS = [
  "Up to $80 a month on school and office supplies, only from Kiddo Supply and Northside Office. Ask me for anything over $30.",
  "We're out of printer paper and dry-erase markers.",
  "Get a new backpack and 6 composition notebooks.",
  "Buy me a video game.",
  "Return the markers, wrong color.",
];

export default function Home() {
  const [s, setS] = useState<State | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => setS(await (await fetch("/api/state")).json()), []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [s?.feed.length]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setInput("");
    setS((p) => p && { ...p, feed: [...p.feed, { kind: "user", text, at: new Date().toISOString() }] });
    await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) });
    await refresh();
    setBusy(false);
  };
  const decide = async (id: string, decision: "approve" | "decline") => {
    setBusy(true);
    await fetch(`/api/approvals/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
    await refresh();
    setBusy(false);
  };
  const connect = async () => {
    const j = await (await fetch("/api/paypal/vault/setup", { method: "POST" })).json();
    if (j.approveUrl) window.location.href = j.approveUrl;
  };
  const saveTestCard = async () => {
    setBusy(true);
    await fetch("/api/paypal/vault/test-card", { method: "POST" });
    await refresh();
    setBusy(false);
  };

  const purchase = (id: string) => s?.purchases.find((p) => p.id === id);
  const approval = (id: string) => s?.approvals.find((a) => a.id === id);
  const m = s?.mandate;
  const pct = m ? Math.min(100, (s!.spent / m.budget) * 100) : 0;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <header className="border-b border-[var(--line)] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent)] font-bold text-white">M</span>
          <div>
            <div className="font-semibold leading-tight">Mandate</div>
            <div className="text-xs text-[var(--muted)]">Your agent shops. Your rules decide.</div>
          </div>
        </div>
        {s && (s.walletSaved ? (
          <span className="rounded-full bg-[var(--ok-bg)] px-3 py-1 text-xs text-[var(--ok)]">
            {s.walletKind === "card" ? "Sandbox test card saved in PayPal Vault" : "PayPal connected"}
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={saveTestCard} disabled={!s.paypalConfigured || busy} title="Saves PayPal's sandbox test Visa to the Vault, no login needed" className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm disabled:opacity-50">
              Use test card
            </button>
            <button onClick={connect} disabled={!s.paypalConfigured} className="rounded-full bg-[#0070e0] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              Connect PayPal
            </button>
          </div>
        ))}
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-4 p-4 md:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex min-w-0 h-[calc(100vh-110px)] flex-col rounded-2xl border border-[var(--line)] bg-[var(--card)]">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {s?.feed.length === 0 && (
              <div className="text-sm text-[var(--muted)]">
                Start by telling me your rules in plain English, then ask me to buy something.
              </div>
            )}
            {s?.feed.map((f, i) => {
              if (f.kind === "user") return <div key={i} className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-[var(--accent)] px-3 py-2 text-white">{f.text}</div>;
              if (f.kind === "agent") return <div key={i} className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-[var(--bubble)] px-3 py-2">{f.text}</div>;
              if (f.kind === "mandate" && m) return <div key={i} className="text-xs text-[var(--muted)]">Mandate saved: {m.name}</div>;
              if (f.kind === "denied") return (
                <div key={i} className="max-w-[85%] rounded-xl border border-[var(--bad)] bg-[var(--bad-bg)] p-3 text-sm">
                  <div className="font-medium text-[var(--bad)]">Blocked by your mandate · {usd(f.total)}</div>
                  <ul className="mt-1 list-disc pl-5">{f.reasons.map((r, j) => <li key={j}>{r}</li>)}</ul>
                </div>
              );
              if (f.kind === "approval") {
                const a = approval(f.approvalId);
                if (!a) return null;
                return (
                  <div key={i} className="max-w-[85%] rounded-xl border border-[var(--warn)] bg-[var(--warn-bg)] p-3 text-sm">
                    <div className="font-medium">Needs your OK · {usd(a.total)}</div>
                    <ul className="mt-1">{a.cart.map((c, j) => <li key={j}>{c.quantity} × {c.name} <span className="text-[var(--muted)]">({c.merchant})</span> · {usd(c.unitAmount * c.quantity)}</li>)}</ul>
                    <p className="mt-1 italic">{a.explanation}</p>
                    {a.status === "pending" ? (
                      <div className="mt-2 flex gap-2">
                        <button disabled={busy} onClick={() => decide(a.id, "approve")} className="rounded-lg bg-[#0070e0] px-3 py-1.5 text-white">Approve and pay with PayPal</button>
                        <button disabled={busy} onClick={() => decide(a.id, "decline")} className="rounded-lg border border-[var(--line)] px-3 py-1.5">Decline</button>
                      </div>
                    ) : <div className="mt-2 text-xs text-[var(--muted)]">{a.status}</div>}
                  </div>
                );
              }
              if (f.kind !== "purchase" && f.kind !== "refund") return null;
              const p = purchase(f.purchaseId);
              if (!p) return null;
              if (f.kind === "refund") return (
                <div key={i} className="max-w-[85%] rounded-xl border border-[var(--line)] p-3 text-sm">
                  Refunded {usd(p.refunded?.amount ?? p.total)} to your PayPal · {p.refunded?.reason}
                </div>
              );
              return (
                <div key={i} className="max-w-[85%] rounded-xl border border-[var(--ok)] bg-[var(--ok-bg)] p-3 text-sm">
                  <div className="font-medium text-[var(--ok)]">Paid with PayPal · {usd(p.total)}</div>
                  <ul className="mt-1">{p.items.map((c, j) => <li key={j}>{c.quantity} × {c.name} <span className="text-[var(--muted)]">({c.merchant})</span></li>)}</ul>
                  <p className="mt-1"><span className="font-medium">Why:</span> {p.explanation}</p>
                  {p.rule && <p className="text-xs text-[var(--muted)]">Allowed because: {p.rule}</p>}
                  <p className="text-xs text-[var(--muted)]">PayPal order {p.orderId}</p>
                </div>
              );
            })}
            {busy && <div className="text-sm text-[var(--muted)]">Mandate is working…</div>}
            <div ref={end} />
          </div>
          <div className="border-t border-[var(--line)] p-3">
            <div className="mb-2 flex gap-2 overflow-x-auto">
              {SUGGESTIONS.map((t) => (
                <button key={t} onClick={() => send(t)} disabled={busy} className="shrink-0 rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--fg)]">
                  {t.length > 48 ? t.slice(0, 46) + "…" : t}
                </button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Set your rules, or ask me to buy something"
                className="flex-1 rounded-xl border border-[var(--line)] bg-transparent px-3 py-2 outline-none focus:border-[var(--accent)]" />
              <button disabled={busy} className="rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-white disabled:opacity-50">Send</button>
            </form>
          </div>
        </section>

        <aside className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
            <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Your mandate</div>
            {m ? (
              <>
                <div className="mt-1 text-lg font-semibold">{m.name}</div>
                <div className="mt-2 h-2 rounded-full bg-[var(--bubble)]"><div className="h-2 rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} /></div>
                <div className="mt-1 text-sm">{usd(s!.spent)} of {usd(m.budget)} this {m.period}</div>
                <dl className="mt-3 space-y-1 text-sm">
                  <div><dt className="inline text-[var(--muted)]">Ask me above: </dt><dd className="inline">{usd(m.approvalThreshold)}</dd></div>
                  {m.maxItemPrice !== undefined && <div><dt className="inline text-[var(--muted)]">Max per item: </dt><dd className="inline">{usd(m.maxItemPrice)}</dd></div>}
                  <div><dt className="inline text-[var(--muted)]">Stores: </dt><dd className="inline">{m.allowedMerchants.join(", ") || "any"}</dd></div>
                  <div><dt className="inline text-[var(--muted)]">Categories: </dt><dd className="inline">{m.allowedCategories.join(", ") || "any"}</dd></div>
                  {m.blockedKeywords.length > 0 && <div><dt className="inline text-[var(--muted)]">Never buy: </dt><dd className="inline">{m.blockedKeywords.join(", ")}</dd></div>}
                </dl>
              </>
            ) : <p className="mt-1 text-sm text-[var(--muted)]">No rules yet. Describe them in the chat.</p>}
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
            <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Activity</div>
            {s?.purchases.length ? (
              <ul className="mt-2 space-y-2 text-sm">
                {s.purchases.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span className={p.refunded ? "line-through text-[var(--muted)]" : ""}>{p.items.map((i) => i.name).join(", ")}</span>
                    <span className="shrink-0">{p.refunded ? "refunded" : usd(p.total)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-1 text-sm text-[var(--muted)]">No purchases yet.</p>}
          </div>
          {s && !s.paypalConfigured && (
            <p className="text-xs text-[var(--bad)]">PayPal sandbox keys are not set on the server.</p>
          )}
        </aside>
      </main>
    </div>
  );
}
