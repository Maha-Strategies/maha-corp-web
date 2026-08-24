// app/audit/page.tsx
// Client page for the Maha Provenance Auditor.
// Identical UI to the demo artifact; the only functional change is that it
// calls the internal /api/audit route instead of the Anthropic API directly.

"use client";

import React, { useState, useMemo } from "react";

const TAGS: Record<string, { color: string; bg: string; label: string; def: string }> = {
  VERIFIED: { color: "var(--status-verified)", bg: "var(--surface-verified)", label: "VERIFIED", def: "Checked against a primary source or reproduced first-hand." },
  SOURCED: { color: "var(--status-sourced)", bg: "var(--surface-sourced)", label: "SOURCED", def: "Attributed to an identified, citable source; not independently verified." },
  BOUNDARY: { color: "var(--status-boundary)", bg: "var(--surface-boundary)", label: "BOUNDARY", def: "Honestly reports the limits of knowledge — open questions, conjecture." },
  ILLUSTRATIVE: { color: "var(--status-illustrative)", bg: "var(--surface-illustrative)", label: "ILLUSTRATIVE", def: "Analogy or example. Explains; asserts nothing about the world." },
  UNVERIFIED: { color: "var(--status-unverified)", bg: "var(--surface-unverified)", label: "UNVERIFIED", def: "Asserted without confirmation. A workflow state, not a shipping state." },
};

const SAMPLE = `M-Theory unified the five competing string theories in the mid-1990s, when Edward Witten showed they were different limits of a single framework. The theory predicts eleven dimensions of spacetime. No experiment has ever confirmed a distinctive prediction of string theory. Studies show that 87% of readers cannot distinguish AI-generated text from human writing. Think of the self as the moon: bright, but shining entirely by borrowed light. Whether M-Theory describes our universe remains an open question that may not be settled for decades. Our previous audit of AI-generated citations found fabricated references in the majority of unchecked drafts.`;

const LOADING_LINES = [
  "Reading the manuscript…",
  "Isolating substantive claims…",
  "Weighing each claim's evidence…",
  "Assigning provenance tags…",
];

type Claim = { excerpt: string; tag: keyof typeof TAGS; rationale: string; action?: string };

export default function AuditPage() {
  const [text, setText] = useState("");
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [auditedText, setAuditedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  const charactersRemaining = 6_000 - text.length;

  const runAudit = async () => {
    const input = text.trim();
    if (!input) { setError("Paste a passage to audit — or load the sample."); return; }
    setLoading(true); setError(""); setClaims(null); setSelected(null);
    const ticker = setInterval(() => setLoadStep((s: number) => (s + 1) % LOADING_LINES.length), 1600);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Audit failed");
      setClaims(data.claims);
      setAuditedText(input);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "The audit didn't complete. Please try again.");
    } finally {
      clearInterval(ticker); setLoading(false); setLoadStep(0);
    }
  };

  const downloadRecord = () => {
    if (!claims) return;
    const countsByTag: Record<string, number> = {};
    Object.keys(TAGS).forEach((t) => (countsByTag[t] = 0));
    claims.forEach((c: Claim) => countsByTag[c.tag]++);
    const record = {
      mps_version: "0.1",
      document: "pasted passage (free preflight)",
      audited: new Date().toISOString().slice(0, 10),
      compliance_level: "MPS-Declared (free preflight)",
      claims: claims.map((c: Claim, i: number) => ({
        id: `c${String(i + 1).padStart(3, "0")}`,
        excerpt: c.excerpt,
        tag: c.tag,
        rationale: c.rationale,
        source: null,
        action: c.action || "none",
      })),
      summary: {
        counts_by_tag: countsByTag,
        compliance: countsByTag.UNVERIFIED === 0 ? "pass" : "conditional",
      },
      note: "Free preflight record. VERIFIED status requires human confirmation against primary sources; the source passage is not included in this export or retained by Maha.",
      standard: "https://mahastrategies.com/mps",
      doi: "10.5281/zenodo.21241308",
    };
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mps-audit-${record.audited}.json`;
    a.click();
    URL.revokeObjectURL(url);
    void fetch("/api/audit/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "record_downloaded" }),
    }).catch(() => undefined);
  };

  const segments = useMemo(() => {
    if (!claims || !auditedText) return null;
    const marks: { start: number; end: number; i: number }[] = [];
    claims.forEach((c: Claim, i: number) => {
      const idx = auditedText.indexOf(c.excerpt);
      if (idx >= 0) marks.push({ start: idx, end: idx + c.excerpt.length, i });
    });
    marks.sort((a, b) => a.start - b.start);
    const segs: { text: string; claim?: number }[] = [];
    let pos = 0;
    marks.forEach((m) => {
      if (m.start < pos) return;
      if (m.start > pos) segs.push({ text: auditedText.slice(pos, m.start) });
      segs.push({ text: auditedText.slice(m.start, m.end), claim: m.i });
      pos = m.end;
    });
    if (pos < auditedText.length) segs.push({ text: auditedText.slice(pos) });
    return segs;
  }, [claims, auditedText]);

  const counts = useMemo(() => {
    if (!claims) return null;
    const c: Record<string, number> = {};
    Object.keys(TAGS).forEach((t) => (c[t] = 0));
    claims.forEach((cl: Claim) => c[cl.tag]++);
    return c;
  }, [claims]);

  const owed = claims ? claims.filter((c: Claim) => c.tag === "UNVERIFIED").length : 0;

  return (
    <div className="evidence-page" style={{ fontFamily: "'Newsreader', Georgia, serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .mono { font-family: 'IBM Plex Mono', monospace; }
        .mark { cursor: pointer; border-radius: 2px; padding: 1px 2px; border-bottom: 2px solid; transition: filter .15s; }
        .mark:hover { filter: brightness(0.92); }
        textarea:focus, button:focus { outline: 2px solid var(--text-primary); outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
      `}</style>

      <div className="evidence-container evidence-container--narrow">
        <p className="evidence-kicker flex flex-wrap justify-between gap-3 border-t border-[var(--border-default)] pt-5">
          <span>Maha Provenance Standard</span><span>MPS/0.1 · Free preflight</span>
        </p>

        <h1 className="evidence-title evidence-title--product">Run a free claim preflight.</h1>
        <p className="evidence-lede mt-7 mb-8">
          Paste a short nonfiction passage. MPS isolates its substantive claims and marks
          their epistemic status, so you can see what a reader is being asked to trust.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 34 }}>
          {Object.entries(TAGS).map(([k, t]) => (
            <div key={k} title={t.def} style={{ background: t.bg, borderLeft: `3px solid ${t.color}`, padding: "6px 10px", borderRadius: 2 }}>
              <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: t.color, letterSpacing: "0.08em" }}>{t.label}</span>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", maxWidth: 200, lineHeight: 1.35, marginTop: 2 }}>{t.def}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 3, padding: 18 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.14em", color: "var(--text-muted)", marginBottom: 10 }}>PASSAGE UNDER AUDIT · FREE PUBLIC PREFLIGHT</div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste up to ~1,000 words of nonfiction prose…"
            style={{ width: "100%", minHeight: 150, border: "none", background: "transparent", fontFamily: "'Newsreader', Georgia, serif", fontSize: 17, lineHeight: 1.6, color: "var(--text-primary)", resize: "vertical", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={runAudit} disabled={loading} className="mono"
              style={{ background: "var(--text-primary)", color: "var(--surface-paper)", border: "none", padding: "11px 22px", fontSize: 13, letterSpacing: "0.1em", cursor: loading ? "wait" : "pointer", borderRadius: 2 }}>
              {loading ? LOADING_LINES[loadStep] : "RUN FREE PREFLIGHT"}
            </button>
            <button onClick={() => { setText(SAMPLE); setError(""); }} className="mono"
              style={{ background: "transparent", color: "var(--text-primary)", border: "1px solid var(--text-muted)", padding: "10px 16px", fontSize: 13, letterSpacing: "0.1em", cursor: "pointer", borderRadius: 2 }}>
              LOAD SAMPLE
            </button>
            {error && <span style={{ color: "var(--status-unverified)", fontSize: 14 }}>{error}</span>}
          </div>
          <p style={{ margin: "14px 0 0", color: "var(--text-muted)", fontSize: 13, lineHeight: 1.5 }}>
            {charactersRemaining.toLocaleString()} characters remaining · 3 free runs per visitor each day. Maha does not save the full passage in its audit ledger; it is sent to an AI provider only to generate this audit.
          </p>
        </div>

        {claims && counts && segments && (
          <div style={{ marginTop: 40 }}>
            <div className="mono" style={{ fontSize: 11, letterSpacing: "0.14em", color: "var(--text-muted)", marginBottom: 8 }}>
              PROVENANCE SPECTRUM · {claims.length} CLAIMS · {owed === 0 ? "0 OWED VERIFICATION" : `${owed} OWED VERIFICATION`}
            </div>
            <div style={{ display: "flex", height: 14, borderRadius: 2, overflow: "hidden", border: "1px solid var(--border-default)", marginBottom: 26 }}>
              {Object.entries(TAGS).map(([k, t]) => (counts[k] > 0 ? (
                <div key={k} style={{ flex: counts[k], background: t.color }} title={`${t.label}: ${counts[k]}`} />
              ) : null))}
            </div>

            <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 3, padding: "22px 24px", fontSize: 17.5, lineHeight: 1.85 }}>
              {segments.map((s, i) => s.claim === undefined
                ? <span key={i}>{s.text}</span>
                : <span key={i} className="mark"
                    onClick={() => setSelected(selected === s.claim ? null : (s.claim as number))}
                    style={{ background: TAGS[claims[s.claim!].tag].bg, borderBottomColor: TAGS[claims[s.claim!].tag].color }}>
                    {s.text}
                    <sup className="mono" style={{ fontSize: 9, color: TAGS[claims[s.claim!].tag].color, fontWeight: 600, marginLeft: 2 }}>
                      {claims[s.claim!].tag.slice(0, 3)}
                    </sup>
                  </span>
              )}
            </div>

            <div style={{ marginTop: 26 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div className="mono" style={{ fontSize: 11, letterSpacing: "0.14em", color: "var(--text-muted)" }}>AUDIT LEDGER</div>
                <button onClick={downloadRecord} className="mono"
                  style={{ background: "transparent", color: "var(--text-primary)", border: "1px solid var(--text-muted)", padding: "7px 14px", fontSize: 11, letterSpacing: "0.1em", cursor: "pointer", borderRadius: 2 }}>
                  DOWNLOAD AUDIT RECORD (JSON)
                </button>
              </div>
              {claims.map((c, i) => (
                <div key={i} onClick={() => setSelected(selected === i ? null : i)}
                  style={{ background: selected === i ? TAGS[c.tag].bg : "var(--surface-raised)", border: "1px solid var(--border-subtle)", borderLeft: `3px solid ${TAGS[c.tag].color}`, padding: "12px 16px", marginBottom: 8, borderRadius: 2, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontStyle: "italic", fontSize: 15.5 }}>“{c.excerpt}”</span>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: TAGS[c.tag].color, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>[{c.tag}]</span>
                  </div>
                  <div style={{ fontSize: 14.5, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 }}>
                    {c.rationale}
                    {c.action && c.action !== "none" && (
                      <span className="mono" style={{ marginLeft: 8, fontSize: 11, color: "var(--text-primary)", background: "var(--surface-subtle)", padding: "2px 7px", borderRadius: 2, letterSpacing: "0.06em" }}>
                        ACTION: {c.action.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 22, lineHeight: 1.55, maxWidth: 640 }}>
              Free preflight — tags reflect what an auditor can determine from the text alone; VERIFIED
              status requires human confirmation against primary sources. Full manuscript audits produce
              a structured MPS/0.1 record with source-by-source resolution.
              <span className="mono" style={{ display: "block", marginTop: 8, fontSize: 11, letterSpacing: "0.12em" }}>
                MAHA STRATEGIES LLC · <a href="/mps" style={{ color: "var(--text-muted)" }}>THE STANDARD (MPS/0.1)</a> · <a href="https://doi.org/10.5281/zenodo.21241308" style={{ color: "var(--text-muted)" }}>DOI: 10.5281/ZENODO.21241308</a>
              </span>
            </p>

            <div style={{ marginTop: 30, background: "var(--text-primary)", color: "var(--surface-paper)", borderRadius: 3, padding: "22px 24px", maxWidth: 640 }}>
              <div className="mono" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--text-muted)", marginBottom: 10 }}>
                GO BEYOND THE FREE PREFLIGHT
              </div>
              <p style={{ fontSize: 16.5, lineHeight: 1.6, margin: "0 0 16px" }}>
                Run a private MPS Preflight on an extract of up to about 2,000 words, then receive a
                structured claim map and verification backlog. For complete manuscripts or source-by-source
                resolution, request a human Evidence Audit.
              </p>
              <a href="/mps/preflight" className="mono"
                style={{ display: "inline-block", background: "var(--surface-paper)", color: "var(--text-primary)", padding: "10px 18px", fontSize: 12, letterSpacing: "0.1em", textDecoration: "none", borderRadius: 2 }}>
                RUN PRIVATE PREFLIGHT — $49 →
              </a>
              <a href="/mps/preflight/example" className="mono" style={{ display: "inline-block", marginLeft: 14, fontSize: 12, color: "var(--surface-paper)", textDecoration: "underline", textUnderlineOffset: 4 }}>
                SEE SAMPLE REPORT
              </a>
              <span className="mono" style={{ marginLeft: 14, fontSize: 12, color: "var(--text-muted)" }}>
                or <a href="/contact" style={{ color: "var(--surface-paper)" }}>request human review</a>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
