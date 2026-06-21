/**
 * The payment domain — a HOSTED payment link (the provider hosts the checkout page;
 * card data never touches this code, so PCI scope stays with the provider). Not a
 * transparent/embedded checkout.
 */
export interface CheckoutInput {
  /** Amount in the smallest currency unit (e.g. cents). */
  amount: number;
  currency: string;
  description?: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
}

export interface PaymentEvent {
  type: string;
  id: string;
  raw: unknown;
}

export interface Payment {
  /** Create a provider-hosted payment link; returns the URL to redirect the user to. */
  createPaymentLink(input: CheckoutInput): Promise<string>;
  /** Verify (signature) + parse a provider webhook. */
  parseWebhook(body: string, signature: string): Promise<PaymentEvent>;
}
