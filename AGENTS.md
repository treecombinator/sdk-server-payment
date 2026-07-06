# AGENTS.md — @treecombinator/sdk-server-payment

Payment domain of the Tree Combinator SDK. Provider-hosted payment link (the checkout page lives on the provider, so no card data touches this code — PCI stays with the provider). Current adapter: Stripe Checkout over `fetch`, with Web Crypto for webhook signature verification.

## Use

```ts
import { createPayment } from "@treecombinator/sdk-server-payment";

const payment = createPayment({ secretKey, webhookSecret });
const url = await payment.createPaymentLink({ amount, currency, successUrl, cancelUrl });
const event = await payment.parseWebhook(rawBody, signatureHeader); // pass the RAW body
```

`createPayment({ secretKey, webhookSecret, webhookToleranceSec? })` → `createPaymentLink(input)`, `parseWebhook(body, signature)`.
Wire types: `CheckoutInput`, `PaymentEvent`, `Payment`; adapter config `StripeConfig`.

## Notes

- `parseWebhook` needs the **raw** body (any reserialization breaks the HMAC-SHA256 signature); `signature` is the `Stripe-Signature` header. Any of the header's `v1` entries may match (secret rotation); signed timestamps older than `webhookToleranceSec` (default 300s) are rejected to block replay.
- Errors are `TcError` (from `@treecombinator/sdk-common`) with specific codes: `payment_link_failed`, `webhook_signature_invalid`, `webhook_signature_expired`.
- Signature verification is HMAC-SHA256 via Web Crypto with a constant-time compare — no extra runtime dependency.
