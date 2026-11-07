import { vaultTestCard, PayPalError } from "@/lib/paypal";
import { load, save } from "@/lib/store";

// Saves PayPal's sandbox test Visa to the Vault so the agent can pay without a sandbox PayPal login.
export async function POST() {
  try {
    const { vaultId } = await vaultTestCard();
    const s = await load();
    s.vaultId = vaultId;
    s.walletKind = "card";
    delete s.pendingSetupToken;
    await save(s);
    return Response.json({ ok: true, walletKind: "card" });
  } catch (e) {
    const status = e instanceof PayPalError ? e.status : 500;
    return Response.json({ error: String(e) }, { status });
  }
}
