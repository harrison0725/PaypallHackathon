import { paypalConfigured } from "@/lib/paypal";
import { load } from "@/lib/store";

export async function GET() {
  const s = await load();
  return Response.json({
    ok: true,
    paypalConfigured: paypalConfigured(),
    anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    walletSaved: Boolean(s.vaultId),
  });
}
