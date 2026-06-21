# @treecombinator/sdk-server-payment

---

> Developed by Danthur Lice.\
> Copyright © 2026 Tree Combinator.\
> Contact: dev (at) treecombinator.com

---

The **payment** domain of the Tree Combinator SDK — creates a provider-hosted payment link (the
checkout page lives on the provider, so card data never touches your code and PCI scope stays with
the provider) and verifies the webhook the provider sends back. The current adapter is Stripe
Checkout, driven over `fetch` with Web Crypto for signature verification — depending only on
`@treecombinator/sdk-common` for the error type.

## Install

```bash
npm install github:treecombinator/sdk-server-payment
```

## Use

```ts
import { createPayment } from "@treecombinator/sdk-server-payment";

const payment = createPayment({
  secretKey: env.STRIPE_SECRET_KEY,
  webhookSecret: env.STRIPE_WEBHOOK_SECRET,
});

// Start a checkout: returns a URL to redirect the user to.
const url = await payment.createPaymentLink({
  amount: 1999, // smallest currency unit (e.g. cents)
  currency: "usd",
  description: "Pro plan",
  successUrl: "https://app.example.com/paid",
  cancelUrl: "https://app.example.com/cart",
  customerEmail: "a@b.com",
  metadata: { orderId: "o_123" },
});

// In your webhook route: verify the signature and parse the event.
const event = await payment.parseWebhook(rawBody, request.headers.get("stripe-signature")!);
if (event.type === "checkout.session.completed") {
  // fulfil the order — event.raw is the full provider payload
}
```

`createPayment({ secretKey, webhookSecret })` returns the payment API:

- `createPaymentLink(input)` — open a provider-hosted checkout session and return the redirect URL.
  `input` is `{ amount, currency, successUrl, cancelUrl, description?, customerEmail?, metadata? }`,
  with `amount` in the smallest currency unit.
- `parseWebhook(body, signature)` — verify the provider's HMAC-SHA256 signature over the raw body,
  then parse it into a `PaymentEvent` `{ type, id, raw }`.

The package also exports the wire types `CheckoutInput`, `PaymentEvent`, `Payment`, and the adapter
config `StripeConfig`.

## Notes

- Pass `parseWebhook` the **raw** request body, exactly as received — any reserialization breaks the
  signature. The `signature` argument is the `Stripe-Signature` header.
- Errors are `TcError` (from `@treecombinator/sdk-common`) with specific codes:
  `payment_link_failed` when the provider rejects the checkout request, and
  `webhook_signature_invalid` when the webhook signature is missing or does not match.
- Signature verification uses HMAC-SHA256 via Web Crypto and a constant-time compare, so it runs on
  any standard runtime with no extra dependency.
