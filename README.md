# Mandate

**An AI shopping agent that only spends within the rules you give it.**

You write a mandate in plain English ("up to $80 a month on school supplies, only from these stores, ask me above $30"). Mandate turns it into rules, shops for you, pays through PayPal, explains every purchase, and can refund its own mistakes.

Built for the PayPal AI Hackathon (Nov 2026).

## Status

Work in progress. Day 1: PayPal money flow (save wallet with Vault, charge it with Orders v2, refund) and the policy engine.

## How it uses PayPal

| PayPal capability | Used for |
| --- | --- |
| Vault v3 (setup tokens, payment tokens) | Save the user's PayPal wallet once so the agent can pay without a redirect |
| Orders v2 with `vault_id` | Agent pays for an approved cart |
| Payments v2 refunds | Agent returns items and refunds the capture |

## How it uses AI

Claude (Anthropic API) runs the agent: it parses the mandate into structured rules, searches products, builds carts and writes the explanation for each purchase. The spending rules are enforced in code (`src/lib/mandate.ts`), not by the model.

## Run locally

1. Create a sandbox app at [developer.paypal.com](https://developer.paypal.com/dashboard/applications/sandbox) and turn on **Vault** (save payment methods) in its features.
2. `cp .env.example .env.local` and fill in the values.
3. `npm install && npm run dev`
4. Open http://localhost:3000/dev, save a wallet with a sandbox **personal** account, charge a test order, then refund it.

## Deploy

`render.yaml` deploys to Render. Set the secret env vars in the Render dashboard and `APP_URL` to the service URL.

## License

MIT
