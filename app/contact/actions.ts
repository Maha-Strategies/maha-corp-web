// app/contact/actions.ts
"use server";

import { Resend } from "resend";

type ContactState = { success: boolean; error: string | null };

export async function submitContactForm(_prevState: ContactState, formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const subject = (formData.get("subject") as string) || "general";
  const message = formData.get("message") as string;
  const decision = formData.get("decision") as string;
  const deadline = formData.get("deadline") as string;

  if (!name || !email || !message) {
    return { success: false, error: "Missing required fields." };
  }

  // Instantiate INSIDE the action, never at module level: a missing key at
  // module scope crashes the entire /contact route render. Here it degrades
  // to a form error instead, and the mailto fallback on the page still works.
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set in this environment.");
    return {
      success: false,
      error: "Mail service unavailable. Please email mayone@mahastrategies.com directly.",
    };
  }

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      // Once your domain is verified in Resend, change to e.g. 'system@mahastrategies.com'
      from: "Maha Strategies <onboarding@resend.dev>",
      to: "mayone@mahastrategies.com",
      subject: `[Maha Strategies inquiry] ${subject.toUpperCase()}`,
      replyTo: email,
      text: `
NEW INQUIRY RECEIVED
--------------------
NAME: ${name}
EMAIL: ${email}
INQUIRY TYPE: ${subject}
DECISION TO INFORM: ${decision || 'Not provided'}
DECISION DEADLINE: ${deadline || 'Not provided'}

QUESTION:
${message}
      `,
    });

    if (error) {
      console.error("Resend rejected the send:", error);
      return {
        success: false,
        error: "Your inquiry could not be sent. Please email mayone@mahastrategies.com directly.",
      };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error("Transmission failed:", error);
    return {
      success: false,
      error: "Your inquiry could not be sent. Please email mayone@mahastrategies.com directly.",
    };
  }
}
