// app/contact/actions.ts
"use server";

import { Resend } from 'resend';

// Initialize Resend with your API key from .env.local
const resend = new Resend(process.env.RESEND_API_KEY);

export async function submitContactForm(prevState: any, formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const subject = formData.get("subject") as string;
  const message = formData.get("message") as string;

  if (!name || !email || !message) {
    return { error: "Missing required fields." };
  }

  try {
    await resend.emails.send({
      // Once you verify your domain in Resend, change this to something like 'system@mahastrategies.com'
      from: "Acme <onboarding@resend.dev>", 
      to: "mayone@mahastrategies.com", // Your actual inbox
      subject: `[Maha Strategies Portal] ${subject.toUpperCase()}`,
      replyTo: email,
      text: `
NEW TRANSMISSION RECEIVED
-------------------------
DESIGNATION (NAME): ${name}
RETURN VECTOR (EMAIL): ${email}
INQUIRY TYPE: ${subject}

PAYLOAD (MESSAGE):
${message}
      `,
    });

    return { success: true, error: null };
  } catch (error) {
    console.error("Transmission failed:", error);
    return { success: false, error: "Network anomaly detected. Transmission failed." };
  }
}