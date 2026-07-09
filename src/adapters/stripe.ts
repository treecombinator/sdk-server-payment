import { TcError } from "@treecombinator/sdk-common";
import type { Payment } from "../port";

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  /** Max accepted age (seconds) of a webhook's signed timestamp — blocks replay. Default 300. */
  webhookToleranceSec?: number;
}

const encoder = new TextEncoder();

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Stripe adapter: Checkout Session (hosted link) + webhook signature verification. */
export function createStripePayment(config: StripeConfig): Payment {
  return {
    async createPaymentLink(input) {
      const body = new URLSearchParams();
      body.set("mode", "payment");
      body.set("success_url", input.successUrl);
      body.set("cancel_url", input.cancelUrl);
      body.set("line_items[0][quantity]", "1");
      body.set("line_items[0][price_data][currency]", input.currency);
      body.set("line_items[0][price_data][unit_amount]", String(input.amount));
      body.set("line_items[0][price_data][product_data][name]", input.description ?? "Payment");
      if (input.customerEmail) body.set("customer_email", input.customerEmail);
      for (const [k, v] of Object.entries(input.metadata ?? {})) body.set(`metadata[${k}]`, v);

      const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.secretKey}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body,
      });
      const text = await res.text();
      let json: { url?: string; error?: unknown } | undefined;
      try {
        json = JSON.parse(text) as { url?: string; error?: unknown };
      } catch {
        // Non-JSON body (proxy error page, HTML) — fall through to the typed error below.
      }
      if (!res.ok || !json?.url) {
        throw new TcError("payment_link_failed", "could not create the hosted payment link", {
          provider: json?.error ?? json ?? text,
        });
      }
      return json.url;
    },

    async parseWebhook(body, signature) {
      // Stripe-Signature header: "t=<timestamp>,v1=<sig>" — secret rotation sends several v1 entries.
      let t: string | undefined;
      const v1s: string[] = [];
      for (const part of signature.split(",")) {
        const [k, ...rest] = part.split("=");
        const key = k?.trim();
        if (key === "t") t = rest.join("=").trim();
        else if (key === "v1") v1s.push(rest.join("=").trim());
      }
      if (!t || v1s.length === 0) throw new TcError("webhook_signature_invalid", "webhook signature missing");
      const expected = await hmacSha256Hex(config.webhookSecret, `${t}.${body}`);
      if (!v1s.some((v1) => timingSafeEqual(expected, v1))) {
        throw new TcError("webhook_signature_invalid", "webhook signature mismatch");
      }
      // The timestamp is signed; rejecting old ones blocks replay of a captured webhook.
      const toleranceSec = config.webhookToleranceSec ?? 300;
      const age = Math.abs(Math.floor(Date.now() / 1000) - Number(t));
      if (!Number.isFinite(age) || age > toleranceSec) {
        throw new TcError("webhook_signature_expired", `webhook timestamp outside the ${toleranceSec}s tolerance`);
      }
      const event = JSON.parse(body) as { type?: string; id?: string };
      return { type: event.type ?? "unknown", id: event.id ?? "", raw: event };
    },
  };
}
