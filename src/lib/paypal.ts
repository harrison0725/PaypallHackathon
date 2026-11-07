// Minimal PayPal REST client for the sandbox: OAuth, Vault v3, Orders v2, Refunds.
const BASE = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export class PayPalError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`PayPal API error ${status}: ${JSON.stringify(body)}`);
  }
}

async function call<T>(method: string, path: string, body?: unknown, requestId?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new PayPalError(res.status, json);
  return json as T;
}

type Link = { href: string; rel: string; method?: string };

/** Step 1 of saving the user's PayPal wallet: returns a setup token and the approval URL. */
export async function createVaultSetupToken(returnUrl: string, cancelUrl: string) {
  const r = await call<{ id: string; status: string; links: Link[] }>("POST", "/v3/vault/setup-tokens", {
    payment_source: {
      paypal: {
        description: "Mandate: let your agent pay within the limits you set",
        usage_type: "MERCHANT",
        usage_pattern: "IMMEDIATE",
        experience_context: {
          brand_name: "Mandate",
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      },
    },
  }, crypto.randomUUID());
  const approve = r.links.find((l) => l.rel === "approve")?.href;
  return { setupTokenId: r.id, approveUrl: approve };
}

/** Step 2: after the buyer approves, exchange the setup token for a reusable payment token. */
export async function createPaymentToken(setupTokenId: string) {
  const r = await call<{ id: string; customer?: { id: string }; payment_source: unknown }>(
    "POST",
    "/v3/vault/payment-tokens",
    { payment_source: { token: { id: setupTokenId, type: "SETUP_TOKEN" } } },
    crypto.randomUUID(),
  );
  return { vaultId: r.id, customerId: r.customer?.id };
}

/** Save a sandbox test card straight to the Vault. No buyer redirect, so judges can try the demo without a sandbox login. */
export async function vaultTestCard() {
  const st = await call<{ id: string; status: string }>("POST", "/v3/vault/setup-tokens", {
    payment_source: {
      card: { number: "4111111111111111", expiry: "2030-12", name: "Mandate Demo", security_code: "123" },
    },
  }, crypto.randomUUID());
  return createPaymentToken(st.id);
}

export type WalletKind = "paypal" | "card";

export type LineItem = { name: string; unitAmount: number; quantity: number; sku?: string };

type Order = {
  id: string;
  status: string;
  purchase_units?: { payments?: { captures?: { id: string; status: string }[] } }[];
};

/** Charge a vaulted PayPal wallet without the buyer present (merchant-initiated). */
export async function payWithVault(opts: {
  vaultId: string;
  kind?: WalletKind;
  items: LineItem[];
  currency?: string;
  description?: string;
  idempotencyKey: string;
}) {
  const currency = opts.currency ?? "USD";
  const total = opts.items.reduce((s, i) => s + i.unitAmount * i.quantity, 0);
  const money = (n: number) => ({ currency_code: currency, value: n.toFixed(2) });
  let order = await call<Order>("POST", "/v2/checkout/orders", {
    intent: "CAPTURE",
    purchase_units: [{
      description: opts.description?.slice(0, 127),
      amount: { ...money(total), breakdown: { item_total: money(total) } },
      items: opts.items.map((i) => ({
        name: i.name.slice(0, 127),
        sku: i.sku,
        quantity: String(i.quantity),
        unit_amount: money(i.unitAmount),
      })),
    }],
    payment_source: opts.kind === "card"
      ? { card: { vault_id: opts.vaultId, stored_credential: { payment_initiator: "MERCHANT", payment_type: "UNSCHEDULED", usage: "SUBSEQUENT" } } }
      : { paypal: { vault_id: opts.vaultId } },
  }, opts.idempotencyKey);
  // Vaulted orders usually complete on creation; capture if they don't.
  if (order.status !== "COMPLETED") {
    order = await call<Order>("POST", `/v2/checkout/orders/${order.id}/capture`, {}, `${opts.idempotencyKey}-cap`);
  }
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  return { orderId: order.id, status: order.status, captureId: capture?.id, total };
}

export async function refundCapture(captureId: string, amount?: number, currency = "USD", note?: string) {
  return call<{ id: string; status: string }>(
    "POST",
    `/v2/payments/captures/${captureId}/refund`,
    {
      ...(amount !== undefined ? { amount: { currency_code: currency, value: amount.toFixed(2) } } : {}),
      ...(note ? { note_to_payer: note.slice(0, 255) } : {}),
    },
    crypto.randomUUID(),
  );
}

export function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}
