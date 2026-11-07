import Anthropic from "@anthropic-ai/sdk";
import { agentTurn } from "@/lib/agent";
import { load, save } from "@/lib/store";

export const maxDuration = 120;

export async function POST(req: Request) {
  const { message } = (await req.json()) as { message?: string };
  if (!message?.trim()) return Response.json({ error: "Empty message" }, { status: 400 });
  const s = await load();
  try {
    await agentTurn(s, message.trim());
  } catch (e) {
    const msg = e instanceof Anthropic.APIError ? `AI service error ${e.status}` : String(e instanceof Error ? e.message : e);
    s.feed.push({ kind: "agent", text: `Something went wrong: ${msg}`, at: new Date().toISOString() });
  }
  await save(s);
  return Response.json({ ok: true });
}
