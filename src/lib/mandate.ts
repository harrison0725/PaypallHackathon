// The mandate and the policy engine. Rules are enforced in code, never only in the prompt.
import { z } from "zod";

export const MandateSchema = z.object({
  name: z.string(),
  budget: z.number().positive(),
  period: z.enum(["week", "month", "once"]),
  currency: z.string().default("USD"),
  approvalThreshold: z.number().nonnegative(),
  maxItemPrice: z.number().positive().optional(),
  allowedCategories: z.array(z.string()).default([]),
  allowedMerchants: z.array(z.string()).default([]),
  blockedKeywords: z.array(z.string()).default([]),
});
export type Mandate = z.infer<typeof MandateSchema>;

export type CartItem = {
  name: string;
  merchant: string;
  category: string;
  unitAmount: number;
  quantity: number;
};

export type Decision =
  | { verdict: "allow"; total: number; reasons: string[] }
  | { verdict: "needs_approval"; total: number; reasons: string[] }
  | { verdict: "deny"; total: number; reasons: string[] };

const norm = (s: string) => s.trim().toLowerCase();

export function checkCart(m: Mandate, cart: CartItem[], spentThisPeriod: number): Decision {
  const total = Math.round(cart.reduce((s, i) => s + i.unitAmount * i.quantity, 0) * 100) / 100;
  const deny: string[] = [];
  const ok: string[] = [];

  if (cart.length === 0) deny.push("The cart is empty.");
  for (const i of cart) {
    if (m.allowedMerchants.length && !m.allowedMerchants.map(norm).includes(norm(i.merchant)))
      deny.push(`${i.merchant} is not on your list of allowed stores.`);
    if (m.allowedCategories.length && !m.allowedCategories.map(norm).includes(norm(i.category)))
      deny.push(`"${i.name}" is in ${i.category}, which this mandate doesn't cover.`);
    const hit = m.blockedKeywords.find((k) => norm(i.name).includes(norm(k)));
    if (hit) deny.push(`"${i.name}" matches the blocked word "${hit}".`);
    if (m.maxItemPrice !== undefined && i.unitAmount > m.maxItemPrice)
      deny.push(`"${i.name}" costs ${i.unitAmount.toFixed(2)}, above the per-item cap of ${m.maxItemPrice.toFixed(2)}.`);
  }
  const remaining = m.budget - spentThisPeriod;
  if (total > remaining)
    deny.push(`This costs ${total.toFixed(2)} but only ${remaining.toFixed(2)} is left in the ${m.period} budget.`);
  else ok.push(`Within budget: ${(remaining - total).toFixed(2)} left after this.`);

  if (deny.length) return { verdict: "deny", total, reasons: deny };
  if (total > m.approvalThreshold)
    return {
      verdict: "needs_approval",
      total,
      reasons: [...ok, `Over your approval limit of ${m.approvalThreshold.toFixed(2)}, so it needs your OK.`],
    };
  return { verdict: "allow", total, reasons: [...ok, `Under your approval limit of ${m.approvalThreshold.toFixed(2)}.`] };
}
