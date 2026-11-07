// Tiny JSON-file store for the prototype. Swap for Postgres before the final deploy.
import { promises as fs } from "fs";
import path from "path";
import type Anthropic from "@anthropic-ai/sdk";
import type { Mandate, CartItem } from "./mandate";

export type Purchase = {
  id: string;
  createdAt: string;
  items: { name: string; merchant?: string; category?: string; unitAmount: number; quantity: number }[];
  total: number;
  orderId: string;
  captureId?: string;
  explanation: string;
  rule?: string;
  refunded?: { refundId: string; amount: number; at: string; reason?: string };
};

export type Approval = {
  id: string;
  createdAt: string;
  cart: CartItem[];
  total: number;
  explanation: string;
  reasons: string[];
  status: "pending" | "approved" | "declined";
  purchaseId?: string;
};

export type FeedItem =
  | { kind: "user"; text: string; at: string }
  | { kind: "agent"; text: string; at: string }
  | { kind: "purchase"; purchaseId: string; at: string }
  | { kind: "approval"; approvalId: string; at: string }
  | { kind: "denied"; reasons: string[]; total: number; at: string }
  | { kind: "refund"; purchaseId: string; at: string }
  | { kind: "mandate"; at: string };

export type State = {
  vaultId?: string;
  /** "paypal" = buyer's PayPal wallet; "card" = sandbox test card saved to the Vault. */
  walletKind?: "paypal" | "card";
  pendingSetupToken?: string;
  mandate?: Mandate;
  purchases: Purchase[];
  approvals: Approval[];
  conversation: Anthropic.MessageParam[];
  feed: FeedItem[];
};

const FILE = path.join(process.env.DATA_DIR ?? path.join(process.cwd(), ".data"), "state.json");

export async function load(): Promise<State> {
  try {
    const s = JSON.parse(await fs.readFile(FILE, "utf8")) as Partial<State>;
    return { purchases: [], approvals: [], conversation: [], feed: [], ...s };
  } catch {
    return { purchases: [], approvals: [], conversation: [], feed: [] };
  }
}

export async function save(s: State) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(s, null, 2));
}

/** Money spent in the mandate's current period, net of refunds. */
export function spentThisPeriod(s: State): number {
  const m = s.mandate;
  if (!m) return 0;
  const now = new Date();
  const start =
    m.period === "week"
      ? new Date(now.getTime() - 7 * 864e5)
      : m.period === "month"
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : new Date(0);
  return s.purchases
    .filter((p) => new Date(p.createdAt) >= start && !p.refunded)
    .reduce((sum, p) => sum + p.total, 0);
}
