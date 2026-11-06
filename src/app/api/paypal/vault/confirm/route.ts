import { createPaymentToken } from "@/lib/paypal";
import { load, save } from "@/lib/store";

// PayPal redirects the buyer here after they approve saving their wallet.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = process.env.APP_URL ?? url.origin;
  const s = await load();
  const setupToken = url.searchParams.get("approval_token_id") ?? s.pendingSetupToken;
  if (!setupToken) return Response.redirect(`${origin}/dev?vault=missing`);
  const { vaultId } = await createPaymentToken(setupToken);
  s.vaultId = vaultId;
  delete s.pendingSetupToken;
  await save(s);
  return Response.redirect(`${origin}/dev?vault=saved`);
}
