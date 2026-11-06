import { refundCapture, PayPalError } from "@/lib/paypal";
import { load, save } from "@/lib/store";

export async function POST(req: Request) {
  const { purchaseId } = (await req.json()) as { purchaseId: string };
  const s = await load();
  const p = s.purchases.find((x) => x.id === purchaseId);
  if (!p?.captureId) return Response.json({ error: "Purchase not found or not captured." }, { status: 404 });
  if (p.refunded) return Response.json({ error: "Already refunded." }, { status: 409 });
  try {
    const r = await refundCapture(p.captureId, undefined, "USD", "Returned by your Mandate agent.");
    p.refunded = { refundId: r.id, amount: p.total, at: new Date().toISOString() };
    await save(s);
    return Response.json(r);
  } catch (e) {
    const status = e instanceof PayPalError ? e.status : 500;
    return Response.json({ error: String(e) }, { status });
  }
}
