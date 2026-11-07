import { executePurchase } from "@/lib/checkout";
import { checkCart } from "@/lib/mandate";
import { noteApproval } from "@/lib/agent";
import { load, save, spentThisPeriod } from "@/lib/store";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { decision } = (await req.json()) as { decision: "approve" | "decline" };
  const s = await load();
  const a = s.approvals.find((x) => x.id === id);
  if (!a || a.status !== "pending") return Response.json({ error: "No pending approval with that id." }, { status: 404 });
  const at = new Date().toISOString();

  if (decision === "decline") {
    a.status = "declined";
    noteApproval(s, id, "The user declined this purchase.");
    s.feed.push({ kind: "agent", text: "Okay, I won't buy that.", at });
    await save(s);
    return Response.json({ ok: true });
  }

  // Re-check the hard limits at approval time (budget may have changed since).
  const d = s.mandate ? checkCart(s.mandate, a.cart, spentThisPeriod(s)) : null;
  if (!d || d.verdict === "deny") {
    a.status = "declined";
    s.feed.push({ kind: "denied", reasons: d?.reasons ?? ["No mandate set."], total: a.total, at });
    await save(s);
    return Response.json({ error: "No longer within the mandate." }, { status: 409 });
  }
  try {
    const p = await executePurchase(s, a.cart, a.explanation, "Approved by you.");
    a.status = "approved";
    a.purchaseId = p.id;
    noteApproval(s, id, `The user approved it and it was paid: purchase ${p.id}, $${p.total.toFixed(2)}.`);
    s.feed.push({ kind: "purchase", purchaseId: p.id, at });
    await save(s);
    return Response.json({ ok: true, purchaseId: p.id });
  } catch (e) {
    s.feed.push({ kind: "agent", text: `Payment failed: ${e instanceof Error ? e.message : e}`, at });
    await save(s);
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
