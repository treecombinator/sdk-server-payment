import type { Payment } from "./port";
import { createStripePayment, type StripeConfig } from "./adapters/stripe";

export type { Payment, CheckoutInput, PaymentEvent } from "./port";
export type { StripeConfig } from "./adapters/stripe";

/** Payment domain factory. Adapter: Stripe (provider-hosted payment link + webhook verification). */
export function createPayment(config: StripeConfig): Payment {
  return createStripePayment(config);
}
