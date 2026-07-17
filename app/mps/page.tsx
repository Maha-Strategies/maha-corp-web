// app/mps/page.tsx
// The Maha Provenance Standard v0.1 — public specification page.
// Static server component; same design system as the auditor at /audit.

import Link from "next/link";

export const metadata = {
  title: "The Maha Provenance Standard (MPS) v0.1",
  description:
    "A claim-level tagging standard for AI-assisted nonfiction. Makes the epistemic status of every substantive claim explicit, auditable, and machine-readable.",
};

const TAGS = [
  { name: "VERIFIED", color: "#237A55", bg: "rgba(35,122,85,0.14)", def: "Confirmed by the author against a primary source, direct computation, or first-hand observation.", test: "Did a human check the primary source or reproduce the result?" },
  { name: "SOURCED", color: "#2D63B8", bg: "rgba(45,99,184,0.13)", def: "Attributed to an identified, citable secondary source the author has read but not independently verified.", test: "Can the reader follow a citation to a real, identified document?" },
  { name: "BOUNDARY", color: "#A06F14", bg: "rgba(176,124,30,0.16)", def: "Accurately reports the limits of knowledge: open questions, untested conjectures, contested findings — where the claim's content is the uncertainty itself.", test: "Is the claim honest about what is not known?" },
  { name: "ILLUSTRATIVE", color: "#6E56A8", bg: "rgba(110,86,168,0.13)", def: "Analogy, thought experiment, composite example, or structural metaphor. Carries explanatory weight only; asserts nothing about the world.", test: "Would the argument survive if this were literally false?" },
  { name: "UNVERIFIED", color: "#B3402E", bg: "rgba(179,64,46,0.14)", def: "Asserted without confirmation: recalled from memory, AI-generated and unchecked, or awaiting verification. A flag of honesty, not a license.", test: "Is this claim still owed work?" },
];

const RULES = [
  "No untagged substantive claims in a compliant document.",
  "UNVERIFIED is a workflow state, not a shipping state. Production documents should carry zero UNVERIFIED tags or justify each remaining one.",
  "Quotations and statistics are never ILLUSTRATIVE. A real-seeming number or quote must be VERIFIED or SOURCED, or removed.",
  "AI-suggested citations are UNVERIFIED until a human opens the source. Citation existence, authorship, and content must all be confirmed for promotion to SOURCED.",
  "Speculative frameworks (untested theory, forecast, conjecture) presented as context take BOUNDARY; mappings drawn from them take ILLUSTRATIVE.",
  "Tags describe status, not confidence. A tag is a record of what checking was done, not how sure the author feels.",
];

const SCHEMA = `{
  "mps_version": "0.1",
  "document": "string (title or URI)",
  "audited": "ISO-8601 date",
  "claims": [
    {
      "id": "c001",
      "excerpt": "verbatim claim text",
      "tag": "VERIFIED | SOURCED | BOUNDARY | ILLUSTRATIVE | UNVERIFIED",
      "rationale": "why this tag",
      "source": "citation or null",
      "action": "none | verify | cite | reword | remove"
    }
  ],
  "summary": { "counts_by_tag": {}, "compliance": "pass | conditional | fail" }
}`;

const sec = { fontSize: 11, letterSpacing: "0.16em", color: "#5A6660", marginBottom: 14, marginTop: 48 } as const;
const body = { fontSize: 17.5, lineHeight: 1.7, color: "#1A2420", maxWidth: 680 } as const;

export default function MpsPage() {
  return (
    <div className="mps-page" style={{ minHeight: "100vh", background: "#EEF1EC", color: "#1A2420", fontFamily: "'Newsreader', Georgia, serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .mono { font-family: 'IBM Plex Mono', monospace; }
        .mps-page a { color: #1A2420; }
      `}</style>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "40px 20px 100px" }}>

        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.18em", color: "#5A6660", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #C8CEC6", paddingBottom: 12 }}>
          <span>MAHA PROVENANCE STANDARD</span><span>MPS/0.1 · SPECIFICATION</span>
        </div>

        <h1 style={{ fontSize: "clamp(34px, 6vw, 54px)", fontWeight: 500, lineHeight: 1.08, margin: "34px 0 14px", letterSpacing: "-0.01em" }}>
          The Maha Provenance Standard
        </h1>
        <p className="mono" style={{ fontSize: 12, letterSpacing: "0.08em", color: "#5A6660", marginBottom: 26 }}>
          v0.1 · DRAFT FOR PUBLIC COMMENT · MAINTAINED BY MAHA STRATEGIES LLC · SPEC TEXT CC BY 4.0 ·{" "}
          <a href="https://doi.org/10.5281/zenodo.21241308" style={{ color: "#5A6660" }}>DOI: 10.5281/ZENODO.21241308</a>
        </p>
        <p style={{ ...body, fontSize: 19 }}>
          MPS is a claim-level tagging system for nonfiction produced with or without AI
          assistance. It makes the epistemic status of every substantive claim in a document
          explicit, auditable, and machine-readable.
        </p>
        <p style={body}>
          It exists because AI-assisted writing fails in a characteristic way: fluent,
          confident, well-formatted fabrication. Document-level disclosure — &ldquo;AI was used
          in this work&rdquo; — tells the reader nothing about <em>which sentences to trust</em>.
          MPS operates at the claim level.
        </p>
        <p style={{ marginTop: 22 }}>
          <Link href="/audit" className="mono" style={{ fontSize: 12, letterSpacing: "0.1em", background: "#1A2420", color: "#EEF1EC", padding: "12px 22px", textDecoration: "none", borderRadius: 2, display: "inline-block" }}>
            RUN A FREE PREFLIGHT →
          </Link>
          <Link href="/mps/preflight" className="mono" style={{ fontSize: 12, letterSpacing: "0.1em", border: "1px solid #1A2420", color: "#1A2420", padding: "11px 20px", textDecoration: "none", borderRadius: 2, display: "inline-block", marginLeft: 10 }}>
            RUN A PRIVATE PREFLIGHT — $49 →
          </Link>
        </p>

        <div className="mono" style={sec}>1 · SCOPE</div>
        <p style={body}>
          MPS applies to <strong>substantive claims</strong>: statements of fact, attribution,
          quantity, causation, or expert consensus that a reader might reasonably rely on. It
          does not apply to opinion clearly framed as opinion, rhetorical questions, or
          structural prose.
        </p>

        <div className="mono" style={sec}>2 · THE FIVE TAGS</div>
        <p style={{ ...body, marginBottom: 18 }}>Every substantive claim receives exactly one tag.</p>
        {TAGS.map((t) => (
          <div key={t.name} style={{ background: t.bg, borderLeft: `3px solid ${t.color}`, padding: "14px 18px", borderRadius: 2, marginBottom: 10, maxWidth: 680 }}>
            <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: t.color, letterSpacing: "0.08em" }}>[{t.name}]</span>
            <p style={{ fontSize: 16, lineHeight: 1.55, margin: "6px 0 4px" }}>{t.def}</p>
            <p style={{ fontSize: 14.5, lineHeight: 1.5, margin: 0, color: "#3A453F", fontStyle: "italic" }}>Test: {t.test}</p>
          </div>
        ))}

        <div className="mono" style={sec}>3 · TAG DISCIPLINE RULES</div>
        <ol style={{ ...body, paddingLeft: 22 }}>
          {RULES.map((r, i) => (
            <li key={i} style={{ marginBottom: 12 }}>{r}</li>
          ))}
        </ol>

        <div className="mono" style={sec}>4 · MACHINE-READABLE SERIALIZATION</div>
        <p style={body}>
          <strong>Inline form</strong> (human-readable documents): a trailing tag per claim or
          claim cluster — <span className="mono" style={{ fontSize: 14 }}>Claim text. [TAG]</span> —
          as practiced across the Maha Strategies book series.
        </p>
        <p style={{ ...body, marginTop: 14 }}>
          <strong>Structured form</strong> (audit records): the JSON record below. The live
          auditor at <Link href="/audit">/audit</Link> exports this format.
        </p>
        <pre className="mono" style={{ background: "#1A2420", color: "#DDE2DB", padding: "18px 20px", borderRadius: 3, fontSize: 13, lineHeight: 1.6, overflowX: "auto", maxWidth: 680 }}>
          {SCHEMA}
        </pre>
        <p style={body}>
          <strong>Site-level declaration:</strong> a document or site may declare its provenance
          regime in <span className="mono" style={{ fontSize: 14 }}>llms.txt</span> or structured-data
          metadata: <span className="mono" style={{ fontSize: 14 }}>provenance-standard: MPS/0.1</span>.
        </p>

        <div className="mono" style={sec}>4A · PUBLIC REGISTRY</div>
        <p style={body}>
          The MPS Registry publishes versioned, machine-readable claim records for this standard.
          Each public record includes its evidence context, review metadata, and a content hash.
        </p>
        <p style={{ marginTop: 22 }}>
          <a href="https://mps.mahastrategies.com/v1/records" target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 12, letterSpacing: "0.1em", background: "#1A2420", color: "#EEF1EC", padding: "12px 22px", textDecoration: "none", borderRadius: 2, display: "inline-block" }}>
            OPEN THE MPS REGISTRY ↗
          </a>
        </p>

        <div className="mono" style={sec}>5 · COMPLIANCE LEVELS</div>
        <p style={body}>
          <strong>MPS-Declared</strong> — the document states it follows MPS and tags its claims.<br />
          <strong>MPS-Audited</strong> — an independent party has produced a structured audit record (§4).<br />
          <strong>MPS-Certified</strong> <em>(reserved)</em> — audited, with all UNVERIFIED resolved and a
          published audit trail.
        </p>

        <div className="mono" style={sec}>6 · RELATIONSHIP TO AI DISCLOSURE</div>
        <p style={body}>
          MPS is complementary to, and stricter than, document-level AI-use disclosure. A
          compliant document additionally discloses how AI was used (drafting, research,
          editing) in front matter. MPS does not prohibit AI assistance; it prohibits
          <strong> unlabeled uncertainty</strong>.
        </p>

        <div className="mono" style={sec}>7 · PROVENANCE OF THIS STANDARD</div>
        <p style={body}>
          Developed 2025–2026 across the Maha Strategies book series and research program,
          including an audit of AI fabrication failure modes and a pre-registered 15,000-query
          study of model reliability. The standard is published under its own discipline.
        </p>

        <div className="mono" style={sec}>8 · AUDITS &amp; ADOPTION</div>
        <p style={body}>
          Maha Strategies conducts full manuscript audits against this standard — every claim
          resolved source-by-source, delivered as a structured MPS/0.1 record. To request an
          audit or discuss adopting MPS for your publication:{" "}
          <a href="/contact">mahastrategies.com/contact</a> or{" "}
          <a href="mailto:mayone@mahastrategies.com">mayone@mahastrategies.com</a>.
        </p>
        <p style={body}>
          Start with a <Link href="/audit">free public preflight</Link> for a short passage, or use the
          private <Link href="/mps/preflight">MPS Preflight</Link> for a longer document extract and a
          retained private report before commissioning a source-by-source human review.
        </p>

        <div style={{ borderTop: "1px solid #C8CEC6", marginTop: 56, paddingTop: 18 }}>
          <p className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", color: "#5A6660", lineHeight: 1.8 }}>
            MAHA STRATEGIES LLC · MAHASTRATEGIES.COM<br />
            FEEDBACK & MANUSCRIPT AUDITS: VIA MAHASTRATEGIES.COM · VERSIONING: SEMANTIC
          </p>
        </div>
      </div>
    </div>
  );
}
