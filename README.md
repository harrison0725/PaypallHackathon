# Mandate

**An AI shopping agent that only spends within the rules you give it.**

You write a mandate in plain English ("up to $80 a month on school supplies, only from these stores, ask me above $30"). Mandate turns it into rules, shops for you, pays through PayPal, explains every purchase, and can refund its own mistakes.

Built for the PayPal AI Hackathon (Nov 2026).

## Status

Work in progress. Done: PayPal money flow (save wallet with Vault, charge it with Orders v2, refund), the policy engine, the Claude agent loop with tools, and the chat UI with approval cards and receipts. Product search uses a seeded catalog of fictional stores for now.

## How it uses PayPal

| PayPal capability | Used for |
| --- | --- |
| Vault v3 (setup tokens, payment tokens) | Save the user's PayPal wallet (or a sandbox test card) once so the agent can pay without a redirect |
| Orders v2 with `vault_id` | Agent pays for an approved cart |
| Payments v2 refunds | Agent returns items and refunds the capture |

## How it uses AI

Claude (Anthropic API) runs the agent: it parses the mandate into structured rules, searches products, builds carts and writes the explanation for each purchase. The spending rules are enforced in code (`src/lib/mandate.ts`), not by the model.

## Run locally

1. Create a sandbox app at [developer.paypal.com](https://developer.paypal.com/dashboard/applications/sandbox) and turn on **Vault** (save payment methods) in its features.
2. `cp .env.example .env.local` and fill in the values.
3. `npm install && npm run dev`
4. Open http://localhost:3000. Click **Connect PayPal** and log in with a sandbox **personal** account, or click **Use test card** to save PayPal's sandbox test Visa to the Vault with no login. Then chat with the agent. `/dev` has a bare test page for the PayPal flow without AI.

## Deploy

`render.yaml` deploys to Render. Set the secret env vars in the Render dashboard and `APP_URL` to the service URL.

## License

MIT
