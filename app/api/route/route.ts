// app/api/audit/route.ts
// Serverless audit endpoint for the Maha Provenance Auditor.
// Holds the ANTHROPIC_API_KEY and the audit prompt server-side so neither
// is exposed to visitors. Deployed automatically by Vercel as a function.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 30; // seconds; audit calls typically finish in 5–15s

const MAX_CHARS = 6000; // ~1,000 words — keeps demo cost bounded

const AUDIT_PROMPT = (passage: string) => `You are an auditor applying the Maha Provenance Standard v0.1 to a nonfiction passage. Tag every SUBSTANTIVE claim (fact, attribution, quantity, causation, consensus). Skip pure opinion and rhetoric.

Tags:
VERIFIED - author could only claim this after checking a primary source or reproducing it. Use rarely; an auditor can seldom confirm this from text alone, so prefer SOURCED or UNVERIFIED.
SOURCED - attributed to an identifiable, citable source, or standard well-documented history/science a reader could cite (name the likely source type in rationale).
BOUNDARY - the claim's content is honest uncertainty: open questions, untested conjecture, stated limits of knowledge.
ILLUSTRATIVE - analogy, metaphor, thought experiment, composite example.
UNVERIFIED - specific numbers, quotes, studies, or findings with no identifiable source; anything that must be checked before publication. Statistics without citations are ALWAYS UNVERIFIED.

Rules: quotations and statistics are never ILLUSTRATIVE. "Studies show" without a named study is UNVERIFIED. First-person references to the author's own prior work are UNVERIFIED from an auditor's seat (cannot confirm).

Respond with ONLY valid JSON, no markdown fences, no preamble:
{"claims":[{"excerpt":"verbatim substring copied EXACTLY from the passage, 6-25 words","tag":"VERIFIED|SOURCED|BOUNDARY|ILLUSTRATIVE|UNVERIFIED","rationale":"one sentence","action":"none|verify|cite|reword|remove"}]}

Excerpts must be exact verbatim substrings of the passage. Passage:

${passage}`;

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "No passage provided." }, { status: 400 });
    }
    if (text.length > MAX_CHARS) {
      return NextResponse.json(
        { error: `Passage too long for the demo (max ~${MAX_CHARS} characters).` },
        { status: 413 }
      );
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: AUDIT_PROMPT(text.trim()) }],
    });

    const raw = message.content
      .map((b: { type: string; text?: string }) => (b.type === "text" ? b.text ?? "" : ""))
      .join("\n");
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean.slice(clean.indexOf("{")));

    const VALID = new Set(["VERIFIED", "SOURCED", "BOUNDARY", "ILLUSTRATIVE", "UNVERIFIED"]);
    const claims = (parsed.claims || []).filter(
      (c: any) => c && typeof c.excerpt === "string" && VALID.has(c.tag)
    );

    if (!claims.length) {
      return NextResponse.json(
        { error: "No substantive claims were identified. Try a longer passage." },
        { status: 422 }
      );
    }

    return NextResponse.json({ mps_version: "0.1", claims });
  } catch (err: any) {
    console.error("audit error:", err?.message || err);
    return NextResponse.json(
      { error: "The audit didn't complete. Please try again." },
      { status: 500 }
    );
  }
}