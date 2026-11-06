import { load } from "@/lib/store";
export async function GET() {
  const s = await load();
  return Response.json({ walletSaved: Boolean(s.vaultId), purchases: s.purchases });
}
