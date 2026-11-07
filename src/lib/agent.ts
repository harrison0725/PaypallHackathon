// The Mandate agent: a manual Claude tool-use loop. Money moves only through
// propose_purchase / refund_purchase, which run the policy engine in code first.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { checkCart, MandateSchema, type CartItem } from "./mandate";
import { searchProducts, getProduct } from "./catalog";
import { executePurchase } from "./checkout";
import { refundCapture } from "./paypal";
import { spentThisPeriod, type State } from "./store";

const MODEL = "claude-opus-5-5";
const client = new Anthropic();

const SYSTEM = `You are Mandate, a shopping agent that buys things for the user with their saved PayPal wallet, but only inside the mandate (spending rules) they have set.

How you work:
- If there is no mandate yet, help the user write one in plain English, then call set_mandate with the structured rules and read them back briefly.
- For a shopping request: search_products, pick the best option (price, rating, fit), then call propose_purchase with the cart and a one-sentence explanation of why you chose it.
- propose_purchase enforces the mandate in code. It returns paid, needs_approval, or denied with reasons. Report the outcome honestly. Never try to split a cart or rephrase an item to get around a rule.
- For returns, call list_purchases to find it, then refund_purchase.
- Keep replies short and friendly: 1 to 3 sentences. Amounts are in USD.`;

const tools: Anthropic.Tool[] = [
  {
    name: "get_mandate",
    description: "Get the user's current mandate (spending rules), how much has been spent this period, and whether a PayPal wallet is connected.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "set_mandate",
    description: "Save the user's mandate as structured rules. Call after the user describes their rules in plain English. Empty lists mean no restriction.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short label, e.g. 'School supplies'" },
        budget: { type: "number", description: "Max spend per period in USD" },
        period: { type: "string", enum: ["week", "month", "once"] },
        approvalThreshold: { type: "number", description: "Purchases above this total need the user's approval" },
        maxItemPrice: { type: "number", description: "Optional cap on any single item's price" },
        allowedCategories: { type: "array", items: { type: "string", enum: ["office", "school", "household", "groceries", "electronics", "games"] } },
        allowedMerchants: { type: "array", items: { type: "string" } },
        blockedKeywords: { type: "array", items: { type: "string" } },
      },
      required: ["name", "budget", "period", "approvalThreshold"],
    },
  },
  {
    name: "search_products",
    description: "Search the product catalog. Returns id, name, store, category, price and rating.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "propose_purchase",
    description: "Try to buy a cart. The mandate is checked in code: inside limits it is paid immediately via PayPal; over the approval threshold it waits for the user; outside the rules it is denied.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: { product_id: { type: "string" }, quantity: { type: "integer", minimum: 1 } },
            required: ["product_id", "quantity"],
          },
        },
        explanation: { type: "string", description: "One sentence: why these items, for the receipt" },
      },
      required: ["items", "explanation"],
    },
  },
  {
    name: "list_purchases",
    description: "List recent purchases with ids, items, totals and refund status.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "refund_purchase",
    description: "Refund a whole purchase through PayPal, e.g. when the user wants to return it.",
    input_schema: {
      type: "object",
      properties: { purchase_id: { type: "string" }, reason: { type: "string" } },
      required: ["purchase_id", "reason"],
    },
  },
];

const ProposeInput = z.object({
  items: z.array(z.object({ product_id: z.string(), quantity: z.number().int().min(1) })).min(1),
  explanation: z.string(),
});

async function runTool(s: State, name: string, input: unknown): Promise<unknown> {
  const at = new Date().toISOString();
  switch (name) {
    case "get_mandate":
      return { mandate: s.mandate ?? null, spentThisPeriod: spentThisPeriod(s), walletConnected: Boolean(s.vaultId) };
    case "set_mandate": {
      s.mandate = MandateSchema.parse(input);
      s.feed.push({ kind: "mandate", at });
      return { saved: s.mandate };
    }
    case "search_products":
      return searchProducts(z.object({ query: z.string() }).parse(input).query);
    case "propose_purchase": {
      if (!s.mandate) return { error: "No mandate set. Ask the user to set one first." };
      const { items, explanation } = ProposeInput.parse(input);
      const cart: CartItem[] = [];
      for (const i of items) {
        const p = getProduct(i.product_id);
        if (!p) return { error: `Unknown product ${i.product_id}` };
        cart.push({ name: p.name, merchant: p.merchant, category: p.category, unitAmount: p.price, quantity: i.quantity });
      }
      const d = checkCart(s.mandate, cart, spentThisPeriod(s));
      if (d.verdict === "deny") {
        s.feed.push({ kind: "denied", reasons: d.reasons, total: d.total, at });
        return { status: "denied", total: d.total, reasons: d.reasons };
      }
      if (d.verdict === "needs_approval") {
        const id = crypto.randomUUID().slice(0, 8);
        s.approvals.unshift({ id, createdAt: at, cart, total: d.total, explanation, reasons: d.reasons, status: "pending" });
        s.feed.push({ kind: "approval", approvalId: id, at });
        return { status: "needs_approval", approvalId: id, total: d.total, reasons: d.reasons };
      }
      const p = await executePurchase(s, cart, explanation, d.reasons.join(" "));
      s.feed.push({ kind: "purchase", purchaseId: p.id, at });
      return { status: "paid", purchaseId: p.id, total: p.total, paypalOrderId: p.orderId };
    }
    case "list_purchases":
      return s.purchases.slice(0, 15).map((p) => ({
        id: p.id, createdAt: p.createdAt, items: p.items.map((i) => `${i.quantity} x ${i.name}`), total: p.total, refunded: Boolean(p.refunded),
      }));
    case "refund_purchase": {
      const { purchase_id, reason } = z.object({ purchase_id: z.string(), reason: z.string() }).parse(input);
      const p = s.purchases.find((x) => x.id === purchase_id);
      if (!p?.captureId) return { error: "Purchase not found." };
      if (p.refunded) return { error: "Already refunded." };
      const r = await refundCapture(p.captureId, undefined, "USD", `Returned by your Mandate agent: ${reason}`);
      p.refunded = { refundId: r.id, amount: p.total, at, reason };
      s.feed.push({ kind: "refund", purchaseId: p.id, at });
      return { status: r.status, refundId: r.id, amount: p.total };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

/** Runs one user turn to completion. Mutates `s` (conversation, feed, purchases); caller saves. */
export async function agentTurn(s: State, userText: string): Promise<void> {
  s.conversation.push({ role: "user", content: userText });
  s.feed.push({ kind: "user", text: userText, at: new Date().toISOString() });

  for (let step = 0; step < 12; step++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "medium" },
      tools,
      messages: s.conversation,
    });
    // Append the full content (including thinking blocks) so history stays append-only.
    s.conversation.push({ role: "assistant", content: res.content });

    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    if (text) s.feed.push({ kind: "agent", text, at: new Date().toISOString() });

    if (res.stop_reason === "refusal") {
      s.feed.push({ kind: "agent", text: "I can't help with that request.", at: new Date().toISOString() });
      return;
    }
    if (res.stop_reason !== "tool_use") return;

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const b of res.content) {
      if (b.type !== "tool_use") continue;
      try {
        results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(await runTool(s, b.name, b.input)) });
      } catch (e) {
        results.push({ type: "tool_result", tool_use_id: b.id, content: String(e instanceof Error ? e.message : e), is_error: true });
      }
    }
    s.conversation.push({ role: "user", content: results });
  }
}

/** Tell the agent (and the conversation) what the user decided on an approval card. */
export function noteApproval(s: State, approvalId: string, outcome: string) {
  s.conversation.push({ role: "user", content: `[Approval ${approvalId}] ${outcome}` });
}
