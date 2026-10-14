/** Seller response limits are separate from the 16 KiB buyer-signature limit.
 * Include the field name, separator and CRLF in the conservative line budget.
 * Base64 is ASCII, but use byte counts so callers cannot confuse UTF-16 length
 * with HTTP bytes. The smaller discovery target leaves room for error text. */
export const PAYMENT_REQUIRED_HEADER_LIMIT = 8_000
export const PAYMENT_REQUIRED_HEADER_BUDGET = 7_600
export const paymentRequiredHeaderBytes = (encoded: string) => Buffer.byteLength('PAYMENT-REQUIRED: ' + encoded + '\r\n', 'utf8')
export function assertPaymentRequiredHeader(encoded: string): string {
  if (paymentRequiredHeaderBytes(encoded) > PAYMENT_REQUIRED_HEADER_LIMIT) throw Error('payment_required_response_header_too_large')
  return encoded
}
