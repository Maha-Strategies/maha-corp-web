import type Stripe from 'stripe'

export async function isInvoicePaymentIntent(
  stripe: Pick<Stripe, 'invoicePayments'>,
  paymentIntentId: string,
) {
  const payments = await stripe.invoicePayments.list({
    payment: { type: 'payment_intent', payment_intent: paymentIntentId },
    limit: 1,
  })
  return payments.data.length > 0
}
