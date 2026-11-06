// Tiny JSON-file store for the prototype. Swap for Postgres before the final deploy.
import { promises as fs } from "fs";
import path from "path";

export type Purchase = {
  id: string;
  createdAt: string;
  items: { name: string; unitAmount: number; quantity: number }[];
  total: number;
  orderId: string;
  captureId?: string;
  explanation: string;
  refunded?: { refundId: string; amount: number; at: string };
};

export type State = {
  vaultId?: string;
  pendingSetupToken?: string;
  purchases: Purchase[];
};

const FILE = path.join(process.env.DATA_DIR ?? path.join(process.cwd(), ".data"), "state.json");

export async function load(): Promise<State> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as State;
  } catch {
    return { purchases: [] };
  }
}

export async function save(s: State) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(s, null, 2));
}
