import { createVaultSetupToken } from "@/lib/paypal";
import { load, save } from "@/lib/store";

export async function POST(req: Request) {
  const origin = process.env.APP_URL ?? new URL(req.url).origin;
  const { setupTokenId, approveUrl } = await createVaultSetupToken(
    `${origin}/api/paypal/vault/confirm`,
    `${origin}/dev?vault=cancelled`,
  );
  const s = await load();
  s.pendingSetupToken = setupTokenId;
  await save(s);
  return Response.json({ approveUrl });
}
