import { payWithVault, PayPalError } from "@/lib/paypal";
import { load, save } from "@/lib/store";

// Dev-only: charge the saved wallet for a fixed test item, no AI involved.
export async function POST() {
  const s = await load();
  if (!s.vaultId) return Response.json({ error: "Save a PayPal wallet first." }, { status: 400 });
  const items = [{ name: "Printer paper, 500 sheets", unitAmount: 8.99, quantity: 1 }];
  try {
    const r = await payWithVault({ vaultId: s.vaultId, items, idempotencyKey: crypto.randomUUID() });
    s.purchases.unshift({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      items,
      total: r.total,
      orderId: r.orderId,
      captureId: r.captureId,
      explanation: "Test purchase from the dev page.",
    });
    await save(s);
    return Response.json(r);
  } catch (e) {
    const status = e instanceof PayPalError ? e.status : 500;
    return Response.json({ error: String(e) }, { status });
  }
}
