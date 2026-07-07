// app/audit/page.tsx
// Client page for the Maha Provenance Auditor.
// Identical UI to the demo artifact; the only functional change is that it
// calls the internal /api/audit route instead of the Anthropic API directly.

"use client";

import React, { useState, useMemo } from "react";

const TAGS: Record<string, { color: string; bg: string; label: string; def: string }> = {
  VERIFIED: { color: "#237A55", bg: "rgba(35,122,85,0.14)", label: "VERIFIED", def: "Checked against a primary source or reproduced first-hand." },
  SOURCED: { color: "#2D63B8", bg: "rgba(45,99,184,0.13)", label: "SOURCED", def: "Attributed to an identified, citable source; not independently verified." },
  BOUNDARY: { color: "#A06F14", bg: "rgba(176,124,30,0.16)", label: "BOUNDARY", def: "Honestly reports the limits of knowledge — open questions, conjecture." },
  ILLUSTRATIVE: { color: "#6E56A8", bg: "rgba(110,86,168,0.13)", label: "ILLUSTRATIVE", def: "Analogy or example. Explains; asserts nothing about the world." },
  UNVERIFIED: { color: "#B3402E", bg: "rgba(179,64,46,0.14)", label: "UNVERIFIED", def: "Asserted without confirmation. A workflow state, not a shipping state." },
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
    } catch (e: any) {
      setError(e.message || "The audit didn't complete. Please try again.");
    } finally {
      clearInterval(ticker); setLoading(false); setLoadStep(0);
    }
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
    <div style={{ minHeight: "100vh", background: "#EEF1EC", color: "#1A2420", fontFamily: "'Newsreader', Georgia, serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .mono { font-family: 'IBM Plex Mono', monospace; }
        .mark { cursor: pointer; border-radius: 2px; padding: 1px 2px; border-bottom: 2px solid; transition: filter .15s; }
        .mark:hover { filter: brightness(0.92); }
        textarea:focus, button:focus { outline: 2px solid #1A2420; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
      `}</style>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "40px 20px 80px" }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.18em", color: "#5A6660", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #C8CEC6", paddingBottom: 12 }}>
          <span>MAHA PROVENANCE STANDARD</span><span>MPS/0.1 · AUDIT DEMO</span>
        </div>

        <h1 style={{ fontSize: "clamp(34px, 6vw, 54px)", fontWeight: 500, lineHeight: 1.05, margin: "34px 0 14px", letterSpacing: "-0.01em" }}>
          Every claim, on the record.
        </h1>
        <p style={{ fontSize: 19, lineHeight: 1.55, maxWidth: 620, margin: "0 0 30px", color: "#3A453F" }}>
          AI-assisted writing fails by sounding certain. This auditor reads a passage,
          isolates its substantive claims, and marks each with its epistemic status —
          the same discipline applied across the Maha Strategies book series.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 34 }}>
          {Object.entries(TAGS).map(([k, t]) => (
            <div key={k} title={t.def} style={{ background: t.bg, borderLeft: `3px solid ${t.color}`, padding: "6px 10px", borderRadius: 2 }}>
              <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: t.color, letterSpacing: "0.08em" }}>{t.label}</span>
              <div style={{ fontSize: 12.5, color: "#3A453F", maxWidth: 200, lineHeight: 1.35, marginTop: 2 }}>{t.def}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "#FBFCFA", border: "1px solid #C8CEC6", borderRadius: 3, padding: 18 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.14em", color: "#5A6660", marginBottom: 10 }}>PASSAGE UNDER AUDIT</div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste up to ~1,000 words of nonfiction prose…"
            style={{ width: "100%", minHeight: 150, border: "none", background: "transparent", fontFamily: "'Newsreader', Georgia, serif", fontSize: 17, lineHeight: 1.6, color: "#1A2420", resize: "vertical", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={runAudit} disabled={loading} className="mono"
              style={{ background: "#1A2420", color: "#EEF1EC", border: "none", padding: "11px 22px", fontSize: 13, letterSpacing: "0.1em", cursor: loading ? "wait" : "pointer", borderRadius: 2 }}>
              {loading ? LOADING_LINES[loadStep] : "RUN AUDIT"}
            </button>
            <button onClick={() => { setText(SAMPLE); setError(""); }} className="mono"
              style={{ background: "transparent", color: "#1A2420", border: "1px solid #9AA49D", padding: "10px 16px", fontSize: 13, letterSpacing: "0.1em", cursor: "pointer", borderRadius: 2 }}>
              LOAD SAMPLE
            </button>
            {error && <span style={{ color: "#B3402E", fontSize: 14 }}>{error}</span>}
          </div>
        </div>

        {claims && counts && segments && (
          <div style={{ marginTop: 40 }}>
            <div className="mono" style={{ fontSize: 11, letterSpacing: "0.14em", color: "#5A6660", marginBottom: 8 }}>
              PROVENANCE SPECTRUM · {claims.length} CLAIMS · {owed === 0 ? "0 OWED VERIFICATION" : `${owed} OWED VERIFICATION`}
            </div>
            <div style={{ display: "flex", height: 14, borderRadius: 2, overflow: "hidden", border: "1px solid #C8CEC6", marginBottom: 26 }}>
              {Object.entries(TAGS).map(([k, t]) => (counts[k] > 0 ? (
                <div key={k} style={{ flex: counts[k], background: t.color }} title={`${t.label}: ${counts[k]}`} />
              ) : null))}
            </div>

            <div style={{ background: "#FBFCFA", border: "1px solid #C8CEC6", borderRadius: 3, padding: "22px 24px", fontSize: 17.5, lineHeight: 1.85 }}>
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
              <div className="mono" style={{ fontSize: 11, letterSpacing: "0.14em", color: "#5A6660", marginBottom: 12 }}>AUDIT LEDGER</div>
              {claims.map((c, i) => (
                <div key={i} onClick={() => setSelected(selected === i ? null : i)}
                  style={{ background: selected === i ? TAGS[c.tag].bg : "#FBFCFA", border: "1px solid #DDE2DB", borderLeft: `3px solid ${TAGS[c.tag].color}`, padding: "12px 16px", marginBottom: 8, borderRadius: 2, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontStyle: "italic", fontSize: 15.5 }}>“{c.excerpt}”</span>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: TAGS[c.tag].color, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>[{c.tag}]</span>
                  </div>
                  <div style={{ fontSize: 14.5, color: "#3A453F", marginTop: 6, lineHeight: 1.5 }}>
                    {c.rationale}
                    {c.action && c.action !== "none" && (
                      <span className="mono" style={{ marginLeft: 8, fontSize: 11, color: "#1A2420", background: "#E2E7DF", padding: "2px 7px", borderRadius: 2, letterSpacing: "0.06em" }}>
                        ACTION: {c.action.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 13.5, color: "#5A6660", marginTop: 22, lineHeight: 1.55, maxWidth: 640 }}>
              Demo audit — tags reflect what an auditor can determine from the text alone; VERIFIED
              status requires human confirmation against primary sources. Full manuscript audits produce
              a structured MPS/0.1 record with source-by-source resolution.
              <span className="mono" style={{ display: "block", marginTop: 8, fontSize: 11, letterSpacing: "0.12em" }}>
                MAHA STRATEGIES LLC · MAHASTRATEGIES.COM
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}