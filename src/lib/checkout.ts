// Pays for a cart with the saved PayPal wallet and records the purchase.
import { payWithVault } from "./paypal";
import type { CartItem } from "./mandate";
import type { State, Purchase } from "./store";

export async function executePurchase(s: State, cart: CartItem[], explanation: string, rule: string): Promise<Purchase> {
  if (!s.vaultId) throw new Error("No PayPal wallet saved yet. Connect PayPal first.");
  const r = await payWithVault({
    vaultId: s.vaultId,
    items: cart.map((i) => ({ name: `${i.name} (${i.merchant})`, unitAmount: i.unitAmount, quantity: i.quantity })),
    description: `Mandate: ${explanation}`,
    idempotencyKey: crypto.randomUUID(),
  });
  if (r.status !== "COMPLETED" || !r.captureId) throw new Error(`PayPal order ${r.orderId} ended as ${r.status}.`);
  const p: Purchase = {
    id: crypto.randomUUID().slice(0, 8),
    createdAt: new Date().toISOString(),
    items: cart.map(({ name, merchant, category, unitAmount, quantity }) => ({ name, merchant, category, unitAmount, quantity })),
    total: r.total,
    orderId: r.orderId,
    captureId: r.captureId,
    explanation,
    rule,
  };
  s.purchases.unshift(p);
  return p;
}
