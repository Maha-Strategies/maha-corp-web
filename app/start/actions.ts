'use server';

import { Resend } from 'resend';

// The key is read server-side only. As long as it is NOT prefixed with
// NEXT_PUBLIC_ in .env.local, it never ships to the browser.
const resend = new Resend(process.env.RESEND_API_KEY);

// --- CONFIGURE THESE ---------------------------------------------------------
// FROM must be an address on a domain you have verified in the Resend dashboard.
// Until you verify mahastrategies.com, you can use Resend's sandbox sender
// 'onboarding@resend.dev' for testing.
const FROM = 'Maha Strategies <noreply@mahastrategies.com>';
// Where YOUR signup notifications land:
const NOTIFY_TO = 'mayone@mahastrategies.com';
// -----------------------------------------------------------------------------

type State = { success: boolean; error: string | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function subscribeToGateway(
  _prevState: State,
  formData: FormData
): Promise<State> {
  const email = String(formData.get('email') ?? '').trim();

  if (!email || !EMAIL_RE.test(email)) {
    return { success: false, error: 'INVALID RETURN VECTOR' };
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: 'TRANSMITTER OFFLINE' };
  }

  try {
    // 1. Notify you that someone signed up.
    const notify = await resend.emails.send({
      from: FROM,
      to: NOTIFY_TO,
      replyTo: email,
      subject: `[GATEWAY] New initiate: ${email}`,
      text: `A new email was submitted on the Start page.\n\nEmail: ${email}\nTime: ${new Date().toISOString()}`,
    });

    if (notify.error) {
      return { success: false, error: 'ROUTING FAILURE' };
    }

    // 2. Welcome the subscriber.
    const welcome = await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Protocol initialized — welcome to the network',
      text:
        'Your signal has been received.\n\n' +
        'You are now on the dispatch list. The next transmission — the 24-Hour ' +
        'Crucible — will arrive shortly.\n\n' +
        'Hold the perimeter.\n\n' +
        '— Maha Strategies',
    });

    if (welcome.error) {
      // You were still notified, so treat this as a soft success but surface it.
      return { success: false, error: 'WELCOME DISPATCH FAILED' };
    }

    return { success: true, error: null };
  } catch {
    return { success: false, error: 'TRANSMISSION INTERRUPTED' };
  }
}
