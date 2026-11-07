import { load, spentThisPeriod } from "@/lib/store";
import { paypalConfigured } from "@/lib/paypal";

export async function GET() {
  const s = await load();
  return Response.json({
    walletSaved: Boolean(s.vaultId),
    walletKind: s.walletKind ?? (s.vaultId ? "paypal" : null),
    paypalConfigured: paypalConfigured(),
    mandate: s.mandate ?? null,
    spent: spentThisPeriod(s),
    purchases: s.purchases,
    approvals: s.approvals,
    feed: s.feed,
  });
}
