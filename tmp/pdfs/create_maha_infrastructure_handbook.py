from __future__ import annotations

from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate, Frame, KeepTogether, PageBreak, Paragraph, Spacer,
    Table, TableStyle, PageTemplate,
)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "pdf" / "maha-strategies-infrastructure-operator-handbook.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

INK = HexColor("#171A20")
MUTED = HexColor("#5D6673")
CYAN = HexColor("#007E99")
CYAN_LIGHT = HexColor("#DDF5FA")
GREEN = HexColor("#176B4A")
AMBER = HexColor("#8A5700")
RED = HexColor("#9B2432")
PAPER = HexColor("#FFFFFF")
LINE = HexColor("#D7DEE5")
PALE = HexColor("#F4F7F9")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverKicker", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10, leading=14, textColor=CYAN, spaceAfter=16, tracking=1.2))
styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=31, leading=35, textColor=INK, spaceAfter=16))
styles.add(ParagraphStyle(name="CoverSub", parent=styles["Normal"], fontName="Helvetica", fontSize=14, leading=20, textColor=MUTED, spaceAfter=14))
styles.add(ParagraphStyle(name="H1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=21, leading=26, textColor=INK, spaceBefore=4, spaceAfter=12, keepWithNext=True))
styles.add(ParagraphStyle(name="H2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=14, leading=18, textColor=INK, spaceBefore=14, spaceAfter=7, keepWithNext=True))
styles.add(ParagraphStyle(name="Body", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.4, leading=14, textColor=INK, spaceAfter=7))
styles.add(ParagraphStyle(name="Small", parent=styles["BodyText"], fontName="Helvetica", fontSize=8, leading=11, textColor=MUTED, spaceAfter=4))
styles.add(ParagraphStyle(name="Callout", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=9.4, leading=14, textColor=INK, spaceAfter=0))
styles.add(ParagraphStyle(name="MahaCode", parent=styles["BodyText"], fontName="Courier", fontSize=7.7, leading=10.7, textColor=INK, leftIndent=7, rightIndent=7, spaceAfter=5))
styles.add(ParagraphStyle(name="Table", parent=styles["BodyText"], fontName="Helvetica", fontSize=7.4, leading=9.6, textColor=INK))
styles.add(ParagraphStyle(name="TableBold", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=7.5, leading=9.7, textColor=INK))


def p(text: str, style: str = "Body"):
    return Paragraph(text, styles[style])


def bullet(text: str):
    return Paragraph("• " + text, styles["Body"])


def title(text: str):
    return Paragraph(text, styles["H1"])


def subtitle(text: str):
    return Paragraph(text, styles["H2"])


def callout(label: str, text: str, color=CYAN_LIGHT):
    tbl = Table([[Paragraph(f"<b>{label}</b><br/>{text}", styles["Callout"])]], colWidths=[6.8 * inch])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("BOX", (0, 0), (-1, -1), 0.6, CYAN if color == CYAN_LIGHT else LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 11), ("RIGHTPADDING", (0, 0), (-1, -1), 11),
        ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return tbl


def simple_table(headers, rows, widths):
    data = [[p(h, "TableBold") for h in headers]]
    for row in rows:
        data.append([p(str(cell), "Table") for cell in row])
    tbl = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#DDEEF3")),
        ("TEXTCOLOR", (0, 0), (-1, 0), INK),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [PAPER, PALE]),
    ]))
    return tbl


def flow_box(label, text, color=CYAN):
    return Table([[p(f"<b>{label}</b><br/>{text}", "Table")]], colWidths=[1.55 * inch], rowHeights=[0.7 * inch],
                 style=TableStyle([("BACKGROUND", (0,0), (-1,-1), PAPER), ("BOX", (0,0), (-1,-1), 1, color),
                                  ("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("LEFTPADDING", (0,0), (-1,-1), 8),
                                  ("RIGHTPADDING", (0,0), (-1,-1), 8), ("TOPPADDING", (0,0), (-1,-1), 6)]))


def header_footer(canvas, doc):
    canvas.saveState()
    if doc.page > 1:
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.5)
        canvas.line(doc.leftMargin, letter[1] - 0.43 * inch, letter[0] - doc.rightMargin, letter[1] - 0.43 * inch)
        canvas.setFont("Helvetica-Bold", 7.5)
        canvas.setFillColor(CYAN)
        canvas.drawString(doc.leftMargin, letter[1] - 0.31 * inch, "MAHA STRATEGIES  /  OPERATOR HANDBOOK")
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(letter[0] - doc.rightMargin, 0.35 * inch, f"Repository guide  •  Page {doc.page}")
    canvas.restoreState()


story = []

# Cover
story += [Spacer(1, 1.05 * inch), p("MAHA STRATEGIES LLC", "CoverKicker"), p("Infrastructure & operations handbook", "CoverTitle"),
          p("A repository-based guide to the public products, private control planes, revenue loops, and human approvals that operate MahaStrategies.com.", "CoverSub"),
          Spacer(1, 0.12 * inch)]
cover_meta = simple_table(
    ["Prepared", "Scope", "Repository baseline"],
    [["22 July 2026", "Current application infrastructure", "main @ 5fdcaff (inbound operations)"]],
    [1.3*inch, 2.55*inch, 2.95*inch])
story += [cover_meta, Spacer(1, 0.30 * inch), callout("HOW TO READ THIS", "Implemented means the code and schema exist in this repository. Enabled means the necessary migration, environment variables, external provider setup, and deployment have also been completed. Human approval remains required wherever a decision can create public content, outreach, financial impact, or a customer commitment."), Spacer(1, 1.4*inch), p("Operating principle", "H2"), p("The system automates collection, validation, routing, measurement, and bounded processing. It does not autonomously publish, send outreach, buy ads, spend money, sign contracts, or decide that a factual claim is true.", "CoverSub"), PageBreak()]

# Executive summary
story += [title("1. Executive summary"),
          p("Maha Strategies is a Next.js application deployed through Vercel, backed by Supabase, Stripe, Resend, Anthropic, Exa, Cloudflare Turnstile, and Google Search Console imports. It contains several connected but deliberately separated systems:"),
          simple_table(["System", "What it does", "Human boundary"], [
              ["Products & commerce", "Books, MPS audit access, MPS Preflight, receipt-to-CSV utility, and research services.", "Stripe payment authority; human scope/price confirmation for service work."],
              ["MPS audit infrastructure", "Public preflight, credentialed API, prepaid audit credits, audit records, refunds, and operator interventions.", "MPS labels evidence status; it does not independently certify truth."],
              ["Revenue operations", "Inbound qualification, revenue ledger, reconciliation, private queue, and metrics.", "No automatic contract, payment, or customer acceptance."],
              ["Discovery & validation", "Search Console signals and read-only Scout evidence become a human-review opportunity queue, then demand, economics, and experiments.", "No automatic launch, ads, outreach, or deployment."],
              ["Content workflow", "Evidence package -> private draft -> score -> human release -> source amendments.", "Every public page requires a score-qualified explicit human confirmation."],
              ["Outbound & CRM", "Private prospects, human-approved drafts, manual-send/reply/win records, and attributed revenue measurement.", "The system never sends an outbound message itself."],
          ], [1.25*inch, 3.25*inch, 2.3*inch]), Spacer(1, 0.18*inch),
          callout("CURRENT OPERATING POSTURE", "The site is a human-supervised commercial operating system, not a fully autonomous company. Its strongest automated loops are payment reconciliation, protected intake, bounded utility processing, audit-credit accounting, research discovery, and measurement. Decisions with reputational, legal, financial, or customer consequences are deliberately gated."),
          subtitle("Primary operator URLs"),
          simple_table(["Purpose", "Private URL", "Token expected"], [
              ["Operator console", "/admin/operations", "Optional: enter existing market, inbound, and/or revenue token for that session"],
              ["Market Scout & opportunity queue", "/admin/market-mapping", "MARKET_MAPPING_TOKEN"],
              ["Demand validation", "/admin/demand-validation", "MARKET_MAPPING_TOKEN"],
              ["SOM & unit economics", "/admin/som-evaluator", "MARKET_MAPPING_TOKEN"],
              ["Experiments", "/admin/experiments", "MARKET_MAPPING_TOKEN"],
              ["Micro-utility validation", "/admin/micro-utility-validations", "MARKET_MAPPING_TOKEN"],
              ["Content workflow", "/admin/content-workflow", "MARKET_MAPPING_TOKEN"],
              ["Published source amendments", "/admin/content-publication-amendments", "MARKET_MAPPING_TOKEN"],
              ["Inbound revenue queue", "/admin/inbound", "INBOUND_OPERATIONS_TOKEN"],
              ["Revenue dashboard", "/admin/revenue", "REVENUE_CONTROL_TOKEN"],
              ["Outbound CRM", "/admin/outbound", "MARKET_MAPPING_TOKEN"],
              ["Sales-pipeline metrics", "/admin/sales-pipeline", "MARKET_MAPPING_TOKEN"],
          ], [1.65*inch, 2.85*inch, 2.3*inch]), Spacer(1, 0.16*inch)]

# Operator console
story += [title("2. Operator console"),
          p("The Operator Console at <font name='Courier'>/admin/operations</font> is the recommended daily starting point. It reduces navigation friction without weakening the system's authorization design. It is a read-only dashboard and navigation layer over the existing private APIs."),
          subtitle("How to use it"),
          simple_table(["Token entered", "What the console reads", "What it never does"], [
              ["MARKET_MAPPING_TOKEN", "Opportunity queue, demand clusters, experiments, content candidates/drafts/handoffs, utility validations, outbound prospects", "Creates no market proposal, content draft, experiment, validation, prospect, or outbound message."],
              ["INBOUND_OPERATIONS_TOKEN", "Counts of active, qualified, and deadline-bearing inbound items", "Displays no inbound PII in the console and takes no queue action."],
              ["REVENUE_CONTROL_TOKEN", "PII-free revenue totals and paid-opportunity funnel", "Records no revenue event, changes no payment, and exposes no customer identity."],
          ], [1.65*inch, 3.35*inch, 1.8*inch]),
          bullet("Paste only the token(s) you need for the current review. They stay in the page's React memory and are cleared by a reload or closing the tab. The console does not write them to localStorage, cookies, a database, logs, or the URL."),
          bullet("Start with the four action cards: market signals to review, active inbound, experiments ready to measure, and publication handoffs ready. Follow the linked specialized workflow for every state change."),
          bullet("Use its sequence as a daily discipline: handle qualified inbound, review evidence, advance at most one supported demand/experiment action, reconcile revenue, then perform only the explicit human release/send actions that are ready."),
          callout("WHY THIS IS THE NEXT BUILD", "The company already has the core ledgers and gates. The greatest operating risk is not a missing automation - it is losing the thread between multiple private screens. The console makes the existing process legible while preserving token separation and human approval."), Spacer(1, 0.16*inch)]

# Architecture
story += [title("3. Architecture at a glance"),
          p("The application uses the App Router and route handlers in Next.js 16.2.6. Supabase stores private ledgers and executes important atomic RPC-backed transitions. Stripe is the source of truth for payments; its signed events create or reverse access and reconcile revenue. Vercel provides deployment and scheduled invocations."),
          Spacer(1, 0.08*inch),
          Table([[flow_box("PUBLIC", "Website, books, tools, contact form, API clients"), p("→", "H1"), flow_box("NEXT.JS", "Pages, public API routes, private admin routes"), p("→", "H1"), flow_box("SUPABASE", "Ledgers, entitlements, credentials, experiments, RLS")]], colWidths=[1.65*inch, .4*inch, 1.65*inch, .4*inch, 1.65*inch], style=TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"), ("ALIGN",(1,0),(1,0),"CENTER"), ("ALIGN",(3,0),(3,0),"CENTER")])) ,
          Spacer(1, 0.15*inch),
          Table([[flow_box("STRIPE", "Checkout, signed webhooks, refunds, disputes", GREEN), p("→", "H1"), flow_box("REVENUE LEDGER", "Idempotent payment and delivery outcomes", GREEN), p("→", "H1"), flow_box("METRICS", "Gross, refunds, net and funnel", GREEN)]], colWidths=[1.65*inch, .4*inch, 1.65*inch, .4*inch, 1.65*inch], style=TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"), ("ALIGN",(1,0),(1,0),"CENTER"), ("ALIGN",(3,0),(3,0),"CENTER")])) ,
          Spacer(1, 0.15*inch),
          Table([[flow_box("SIGNALS", "Search Console + Exa search sources", AMBER), p("→", "H1"), flow_box("HUMAN GATES", "Opportunity, demand, economics, experiment", AMBER), p("→", "H1"), flow_box("MEASUREMENT", "Conversion and sales-pipeline metrics", AMBER)]], colWidths=[1.65*inch, .4*inch, 1.65*inch, .4*inch, 1.65*inch], style=TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"), ("ALIGN",(1,0),(1,0),"CENTER"), ("ALIGN",(3,0),(3,0),"CENTER")])) ,
          subtitle("What is automated"),
          bullet("Schema validation, idempotency checks, database-backed rate limits, honeypot filtering, Turnstile verification when configured, deterministic qualification, receipt upload cleanup, and daily qualified-inbound digest."),
          bullet("Stripe webhook replay protection and atomic changes to audit credits, entitlements, utility-run state, refunds, revenue reconciliation, and delivery states."),
          bullet("Read-only market discovery from configured sources, scoring, deduplication, query rotation, and submission of qualifying evidence to the private opportunity queue."),
          bullet("Public conversion-event capture without cookies or personal identifiers; it provides directional experiment attribution, not individual tracking."),
          subtitle("What remains explicitly human"),
          bullet("Approving/rejecting market signals; declaring demand validated; entering economic assumptions; approving a test; judging a result; retaining or retiring an offer."),
          bullet("Reviewing evidence; editing a draft; responding to a claim; typing a release confirmation; sending outbound email; accepting paid work; making price or contract commitments."),
          bullet("Any direct credential intervention, balance adjustment, revocation, replacement, refund-related operational action, or financial correction."), Spacer(1, 0.16*inch)]

# Configuration
story += [title("4. Deployment, database, and configuration"),
          p("The application needs two aligned states: the Vercel deployment must contain server-only configuration, and the linked Supabase database must have every repository migration applied. Configure values in Vercel for Production (and Preview if testing there). Never put secrets in browser code, source control, URL parameters, or operational notes."),
          subtitle("Minimum shared platform configuration"),
          simple_table(["Provider", "Required configuration", "Why it exists"], [
              ["Supabase", "NEXT_PUBLIC_SUPABASE_URL; SUPABASE_SERVICE_ROLE_KEY", "Private ledgers, RLS, RPCs, state transitions, and auditability."],
              ["Vercel", "Production deployment; CRON_SECRET", "Hosts app and authorizes scheduled cron endpoints."],
              ["Resend", "RESEND_API_KEY; verified sender", "Qualified inbound, agent-inquiry, and optional digest notifications."],
              ["Stripe", "STRIPE_SECRET_KEY plus unique webhook secret per product endpoint", "Checkout and signed payment/reversal events."],
              ["Anthropic", "ANTHROPIC_API_KEY", "MPS processing and optional candidate/draft assistants when enabled."],
              ["Cloudflare", "NEXT_PUBLIC_TURNSTILE_SITE_KEY; TURNSTILE_SECRET_KEY", "Contact-form bot resistance; server validates tokens."],
              ["Exa", "EXA_API_KEY; MARKET_SCOUT_SOURCES=exa", "Read-only discovery evidence for the Scout."],
          ], [1.0*inch, 2.85*inch, 3.0*inch]),
          subtitle("Token separation"),
          simple_table(["Token", "Used for", "Never reuse it for"], [
              ["AGENT_REVIEW_TOKEN", "Private agent inquiry and credential registry", "MPS operator, revenue, market, or browser-facing access."],
              ["MPS_OPERATIONS_TOKEN", "MPS lookup, credits, revocation, credential replacement", "Revenue or agent review."],
              ["REVENUE_CONTROL_TOKEN", "Revenue metrics and control-plane actions", "Any public endpoint or Stripe."],
              ["INBOUND_OPERATIONS_TOKEN", "Private inbound queue", "Other private systems."],
              ["MARKET_MAPPING_TOKEN", "Scout queue, demand, experiments, content workflow, outbound CRM", "Public client code."],
              ["CRON_SECRET", "Vercel scheduled endpoints", "Manual private user interface unlocks."],
          ], [1.65*inch, 2.75*inch, 2.45*inch]),
          subtitle("Enablement checklist"),
          bullet("Run <font name='Courier'>supabase db push</font> only after the local migration directory and remote migration history agree. If Supabase reports remote versions missing locally, repair or pull the history before applying anything new."),
          bullet("Set Stripe webhook endpoints and subscribe only to the events documented for each product. Use a distinct signing secret for each endpoint; test with Stripe test mode before enabling the production feature flag."),
          bullet("Add both <font name='Courier'>mahastrategies.com</font> and <font name='Courier'>www.mahastrategies.com</font> in the Turnstile widget. Leave TURNSTILE_EXPECTED_HOSTNAME unset if both are permitted; otherwise it will reject the alternate host."),
          bullet("After changing Vercel environment variables, redeploy. Public variables prefixed with NEXT_PUBLIC_ are compiled into the browser bundle at build time."),
          callout("ENABLEMENT VS. CODE", "A feature flag such as MPS_AUDIT_CREDIT_CHECKOUT_ENABLED, UTILITY_CHECKOUT_ENABLED, or BOOK_CHECKOUT_ENABLED must be set only after its price IDs, webhook endpoint, secrets, and migrations are verified. The presence of code is not evidence the paid path is live.", HexColor("#FFF4DB")), Spacer(1, 0.16*inch)]

# Offers commerce
story += [title("5. Public products and commerce"),
          p("The public site combines information pages, open book editions, and controlled paid flows. The commercial catalog is represented in the revenue control plane so every intake and payment can be classified consistently."),
          simple_table(["Offer", "Public entry point", "Acquisition / fulfilment"], [
              ["MPS Audit API Access", "/mps/audit-access", "Stripe checkout creates a scoped prepaid credential; webhook activates credits; browser exposes secret once."],
              ["MPS Preflight", "/mps/preflight", "Self-service paid preflight: checkout, report submission, Stripe reconciliation, delivery event."],
              ["Public MPS Audit", "/audit", "Free bounded preflight; three runs/day implementation using HMAC visitor fingerprint; no source text retention."],
              ["Receipt to CSV", "/utilities/receipts", "No-login pay-then-run utility. Client holds receipt data across checkout, paid run is single-use, bad batch auto-refunds when confirmed."],
              ["Books / MCP access", "/books/mcp-access and book pages", "Book Stripe checkout creates entitlement exactly once; full refund or lost dispute revokes only as intended."],
              ["Rapid Intelligence Brief", "/rapid-intelligence-brief", "Human scope and price review; records an inbound/revenue opportunity but no automatic acceptance."],
              ["Verified Research Brief", "/consulting", "Human scope and price review; no automatic contract."],
          ], [1.45*inch, 1.85*inch, 3.55*inch]),
          subtitle("Commerce safety invariants"),
          bullet("Stripe webhooks are deduplicated by Stripe event ID in a unique database ledger. Balance changes and event logging occur atomically; duplicate delivery does not add another balance."),
          bullet("A paid MPS audit reserves one credit before model evaluation. A zero balance stops the request before Anthropic is called and returns HTTP 402 with a purchase URL. Internal meter-only credentials retain their existing behavior."),
          bullet("A failed paid audit returns the reserved credit through an idempotent ledger entry. Utility batches claim their one-time run before fallible work; if nothing usable results, the system tries Stripe refund plus database state confirmation before reporting a refund."),
          bullet("Partial utility refund does not consume a run. Full reversal locks the run token. Book access is revoked only after sufficient cumulative reversal or a lost dispute, not merely from a partial refund."),
          subtitle("Stripe operator checklist"),
          simple_table(["Product family", "Webhook route", "Key events to subscribe"], [
              ["MPS audit credits", "/api/mps-credits/webhook", "checkout.session.completed; checkout.session.async_payment_succeeded; refund.created; refund.updated"],
              ["MPS Preflight", "/api/mps-preflight/webhook", "Configured paid preflight payment/reversal events"],
              ["Books", "/api/books/webhook", "checkout.session.completed; checkout.session.async_payment_succeeded; refund.created; refund.updated; charge.dispute.closed"],
              ["Receipt utility", "/api/utilities/webhook", "Checkout success, refund/dispute reversals for the configured price map"],
          ], [1.45*inch, 2.0*inch, 3.4*inch]), Spacer(1, 0.16*inch)]

# MPS & agent
story += [title("6. MPS and agent infrastructure"),
          subtitle("MPS audit services"),
          p("MPS/0.1 is implemented as a claim-level audit engine. Its records identify claims and evidence-handling statuses. It is a workflow aid, not independent certification or a replacement for a human checking primary sources."),
          simple_table(["Surface", "Access control", "Operational behavior"], [
              ["Credentialed audit API", "Named client credential with mps_audit capability", "Idempotent client request IDs; source passage processed but deliberately not retained; audit output/event history stored."],
              ["Prepaid access", "Credential becomes scoped and active only after signed Stripe confirmation", "Credit pack; 402 zero-balance gate; failed execution credit return."],
              ["Public audit", "Rate-limited anonymous browser usage", "Up to 6,000 characters; HMAC visitor fingerprint; source-free JSON download; no passage/hash stored."],
              ["Operations API", "MPS_OPERATIONS_TOKEN", "Lookup then audited idempotent action: credit adjustment, revocation, replacement."],
          ], [1.45*inch, 2.2*inch, 3.2*inch]),
          subtitle("Lost secret / support runbook"),
          bullet("Never try to recover a stored plaintext credential; it is deliberately shown once only. Look up the record with the private MPS operations endpoint.") ,
          bullet("For a legitimate lost prepaid key, submit the credential-replacement action with unique idempotency key, reason, and support/Stripe reference. The old credential is atomically revoked and only the replacement response can disclose the new secret."),
          bullet("For an engine failure, append a credit correction; do not edit ledger rows directly. For abuse or compromise, revoke the credential. Preserve the immutable operator-action record."),
          subtitle("Agent discovery and intake"),
          p("The application publishes machine-readable commercial discovery material, OpenAPI documents, and an authenticated agent inquiry gateway. Agent inquiries are non-binding: recording one does not create a commission, accept work, charge a buyer, or send work automatically."),
          simple_table(["Endpoint(s)", "Purpose", "Authorization"], [
              ["/agent-offers.json", "Machine-readable offer discovery", "Public"],
              ["/agent-inquiry-schema.json; /.well-known/agent.json", "Schema and agent card", "Public"],
              ["POST /api/agent-inquiries", "Non-binding human-review intake", "Named database-backed client credential"],
              ["/api/agent-credentials", "Issue/review/revoke client credentials", "AGENT_REVIEW_TOKEN"],
              ["POST /api/mps-audits", "Credentialed claim audit", "mps_audit-capable credential"],
              ["/api/mcp-bridge/manifest", "/mcp-bridge", "MCP bridge manifest and public discovery page", "Public"],
          ], [2.1*inch, 2.6*inch, 2.15*inch]),
          callout("MCP REGISTRY NOTE", "The official MCP Registry listing is maintained from the separate maha-agentic-gateway repository, not this website repository. This site exposes the commercial MPS/MCP discovery material; check and update registry metadata in the gateway repository when its transport endpoint or version changes."), Spacer(1, 0.16*inch)]

# Inbound revenue
story += [title("7. Inbound revenue operations"),
          p("Contact and agent submissions are treated as private operational records. The gatekeeper validates a required decision and defined question, applies rate limits and anti-abuse checks, assigns a deterministic status, records a revenue opportunity, and optionally sends a notification. It does not promise service or contact the requester automatically."),
          subtitle("Contact form routing"),
          Table([[flow_box("VISITOR", "Contact form + referral/UTM fields"), p("→", "H1"), flow_box("GATE", "Turnstile, honeypot, schema, classification"), p("→", "H1"), flow_box("LEDGERS", "Inbound submission + revenue opportunity")]], colWidths=[1.65*inch, .4*inch, 1.65*inch, .4*inch, 1.65*inch], style=TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"), ("ALIGN",(1,0),(1,0),"CENTER"), ("ALIGN",(3,0),(3,0),"CENTER")])) ,
          Spacer(1, 0.12*inch),
          bullet("The contact form records allowed referral sources, optional UTM values, campaign detail, and the source path. It screens generic SEO/backlink solicitations out before rate-limit/ledger/notification work; it returns an accepted generic response instead of confirming its anti-abuse decision."),
          bullet("If TURNSTILE_SECRET_KEY is configured, server-side Siteverify is required with action contact_inquiry. The feature is permissive only when the secret is not configured so an incomplete deployment does not break the form; configure it for production."),
          bullet("A genuine qualified entry can trigger best-effort Resend mail to INBOUND_NOTIFICATION_TO. A notification failure does not erase or invalidate the durable ledger record."),
          subtitle("Operating the inbound queue"),
          simple_table(["Step", "Action", "Expected result"], [
              ["1", "Open /admin/inbound with INBOUND_OPERATIONS_TOKEN.", "Review active submissions with class, referral/campaign, decision, question, deadline, and revenue opportunity state."],
              ["2", "Use the queue action and an operator note.", "Move the item through review/qualification/clarification/decline without sending a message or collecting payment."],
              ["3", "For a self-service offer, direct the person to the displayed product page. For services, scope and price manually.", "Commercial intent becomes an explicit revenue opportunity, not an inferred sale."],
              ["4", "Record payment/delivery/refund only from known source events or verified Stripe reconciliation.", "Revenue dashboard reflects actual ledger state."],
          ], [0.4*inch, 3.35*inch, 2.95*inch]),
          subtitle("Daily inbound digest"),
          p("Vercel invokes <font name='Courier'>GET /api/cron/inbound-digest</font> at 13:00 UTC. It sends one daily digest of unsent qualified submissions when INBOUND_DIGEST_TO is set. The endpoint accepts CRON_SECRET (or an explicitly authorized INBOUND_DIGEST_TOKEN for a manual trigger). Treat the digest as sensitive because it includes contact data."), Spacer(1, 0.16*inch)]

# Revenue and outbound
story += [title("8. Revenue ledger, reconciliation, and sales pipeline"),
          subtitle("Offer-to-cash control plane"),
          p("The revenue control plane maintains a non-PII commercial event ledger. It uses stable source references, supported offer IDs, valid state transitions, unique idempotency keys, and Stripe reconciliation. It cannot send mail, charge a buyer, sign a contract, or accept an engagement."),
          simple_table(["State", "Meaning", "How it should be recorded"], [
              ["Routed / review", "Qualified inbound or agent signal exists", "Gatekeeper or explicit operator route."],
              ["Checkout started", "Buyer entered a self-service checkout flow", "Existing product checkout event."],
              ["Paid", "Stripe payment authority has confirmed payment", "Webhook reconciliation or verified operator event."],
              ["Delivered", "Entitlement, credential, report, or utility result issued", "Product delivery logic after payment."],
              ["Refunded", "Payment reversal is confirmed", "Stripe reconciliation; partial reversal remains proportional."],
              ["Declined / closed lost", "Human commercial disposition", "Explicit operator record."],
          ], [1.25*inch, 2.35*inch, 3.5*inch]),
          subtitle("Revenue dashboard"),
          bullet("Open <font name='Courier'>/admin/revenue</font> with REVENUE_CONTROL_TOKEN. The dashboard reads PII-free ledger columns only and aggregates gross, refunds, net, funnel stages, offers, periods, inbound, and utility panels."),
          bullet("A delivered-then-refunded item remains visible in both lifecycle stages because the funnel is append-only-event based, rather than a misleading current-status-only view."),
          subtitle("Approval-gated outbound CRM"),
          p("The private outbound layer is a CRM and draft manager, not an email sender. A prospect must be reviewed, qualified, and have a draft approved before you manually send it from a real email account. Record manual send, reply, win, or loss afterward. The system gives a reproducible funnel without automating contact."),
          subtitle("Sales pipeline measurement"),
          simple_table(["Metric", "Meaning", "Operator rule"], [
              ["Prospects -> qualified -> sent -> replied -> won/lost", "Outbound funnel by offer", "Only record a send after you actually sent it."],
              ["Confirmed linked revenue", "Revenue opportunity linked to outbound prospect", "Create link only when you know the relationship; no inferred attribution."],
              ["Net revenue", "Gross minus refunds by offer/currency", "Stripe reconciliation is the financial basis."],
          ], [1.85*inch, 2.35*inch, 2.9*inch]),
          callout("SOLO-FOUNDER OPERATING RULE", "Keep the source of truth simple: Stripe for payment, Supabase for history and state, your inbox for actual correspondence, and this private pipeline for a consistent record of the decision path. Do not manufacture progression by marking a prospect sent, replied, or won before it happened."), Spacer(1, 0.16*inch)]

# Market mapping
story += [title("9. Market mapping, demand gates, and $5-$10 utility validation"),
          p("Market Mapping is a discovery and research-control system. It is intentionally not an autonomous product factory. It can find attributable signals and calculate a transparent score; it cannot establish demand from topical relevance alone."),
          subtitle("Scout workflow"),
          Table([[flow_box("READ", "Exa and approved read-only sources"), p("→", "H1"), flow_box("FILTER", "Query-quality, source class, direct-demand gate"), p("→", "H1"), flow_box("QUEUE", "Private human review")]], colWidths=[1.65*inch, .4*inch, 1.65*inch, .4*inch, 1.65*inch], style=TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"), ("ALIGN",(1,0),(1,0),"CENTER"), ("ALIGN",(3,0),(3,0),"CENTER")])) , Spacer(1, .12*inch),
          bullet("The default rotating matrix covers MPS claim verification, research briefs, document-data extraction, and receipt operations. It selects five cross-lane queries per UTC day and retrieves at most eight results per query."),
          bullet("The Scout classifies signals as buyer demand, competitor content, marketplace request, or editorial content. It penalizes vendor SEO pages, requires stronger buyer-intent evidence before a high score, drops contextual/topical matches from the active queue, deduplicates, and bounds submissions."),
          bullet("The scheduled Scout route runs at 14:00 UTC. It first requires CRON_SECRET and MARKET_MAPPING_TOKEN; without valid configuration it fails closed and creates no proposal."),
          subtitle("From evidence to an offer test"),
          simple_table(["Gate", "Threshold / action", "What it permits"], [
              ["Opportunity review", "Human approves source-backed items in Market Mapping", "Use as corroborating evidence; not a launch."],
              ["Demand Gate", "3-8 approved signals; at least 2 buyer-demand/marketplace; score >=70", "One bounded experiment."],
              ["SOM evaluator", "Assumptions: price, costs, demand, conversion, competition, willingness-to-pay, policy risk", "Build candidate, validate first, or reject."],
              ["Experiment control", "One hypothesis, one intended change, one KPI, baseline and measure-after date", "Human publishes the change."],
              ["Micro utility validation", "Current supported utility: receipts-to-CSV; typical target $5-$20 and five paid orders", "Approve test -> confirm live -> measure -> retain/retire."],
          ], [1.5*inch, 2.85*inch, 2.75*inch]),
          subtitle("How to operate the loop"),
          bullet("Import Google Search Console queries in Market Mapping. Treat high-impression/low-click terms as hypotheses to improve an existing page first; do not create a duplicate page by default."),
          bullet("Run the Scout only after checking the configured query matrix. If MARKET_SCOUT_QUERY_MATRIX or legacy MARKET_SCOUT_QUERIES is set, it overrides the default lanes."),
          bullet("Approve only direct, attributable signals. Build a demand cluster only when the separate signals genuinely describe the same buyer and job. Enter conservative unit-economics assumptions and document their basis."),
          bullet("Run one test at a time where possible; measure after 14-28 days. Retain only when the metric and paid behavior warrant it, otherwise iterate or retire."), Spacer(1, 0.16*inch)]

# Content
story += [title("10. Content, GEO, and publication workflow"),
          p("The content system is designed to reduce manual work while retaining clear editorial accountability. An assistant can prepare a private candidate or fill a draft suggestion; neither has publication authority. The scoring system checks supplied evidence and editorial completeness, not truth."),
          subtitle("Single workflow"),
          simple_table(["Step", "Where", "Operator action"], [
              ["1. Candidate", "/admin/content-quality or /admin/content-workflow", "Use Candidate Assistant with a reader question or record a package. Verify 3-5 independent credible HTTPS sources with actual titles, dates, type, and source-specific notes."],
              ["2. Evidence approval", "/admin/content-workflow", "Review independence, attribution, reader-first orientation, original analysis, non-doorway status, and human review requirement. Approve only when evidence is usable."],
              ["3. Private composition", "/admin/content-workflow", "Use Draft Assistant to prefill, then edit title, summary, direct answer, Maha method, limits, artifact, and reviewer. Save a private draft only."],
              ["4. Editorial readiness", "/admin/content-workflow", "Review and mark editorial ready, or revise. A revision creates a new private version and supersedes earlier handoff."],
              ["5. Handoff score", "/admin/content-workflow", "Calculate a handoff. It is release-ready only if score >=70 AND all hard blockers clear."],
              ["6. Human release", "/admin/content-workflow", "Choose approved handoff, select slug, read the rendered content, and type exact confirmation. This creates /insights/... plus Article metadata, sources, and sitemap entry."],
              ["7. Corrections", "/admin/content-publication-amendments", "Submit a 3-5 source replacement package with note and explicit AMEND confirmation; original snapshot is preserved."],
          ], [0.6*inch, 2.0*inch, 4.5*inch]),
          subtitle("Publication score"),
          p("The score is deterministic and only as strong as the submitted evidence and form fields. It combines 35% of candidate quality score with items for evidence approval, 3+ sources, policy checks, editorial readiness, title, summary, direct answer, Maha method, limits, artifact, and reviewer assignment. A score of 70 or higher alone does not publish."),
          simple_table(["Hard blocker", "Minimum"], [
              ["Source metadata", "All sources have valid URLs, specific metadata and notes."],
              ["Summary", "At least 120 characters."],
              ["Maha method", "At least 300 characters."],
              ["Limits", "At least 100 characters."],
              ["Evidence artifact", "Both a valid artifact URL and label."],
          ], [2.0*inch, 5.1*inch]),
          callout("EDITORIAL LIMIT", "Neither candidate quality nor handoff score fact-checks the world. A 90/100 score means the required evidence and editorial fields are complete according to the stored contract. Review the underlying sources, dates, scope, and claims before publishing."),
          subtitle("Generative-engine discovery surfaces"),
          p("The site includes entity/context, commercial manifest, agent context, OpenAPI, llms.txt, Atom feed, sitemaps, citation-ready explainers, public books split into chapters, and MPS/MCP discovery pages. Maintain these through normal content quality rather than mass-producing thin pages."), Spacer(1, 0.16*inch)]

# Measurement/privacy
story += [title("11. Search, conversion, and privacy-safe measurement"),
          subtitle("Google Search Console feedback"),
          p("The Market Mapping screen imports query data from a file-driven Search Console flow and presents human-review recommendations. A near-page-one query should normally lead to improving the direct answer and evidence on the existing relevant page, not generating a duplicate article. Submit the current sitemap in Search Console and Bing; their crawlers discover subsequent sitemap changes automatically, but important new pages can be inspected individually."),
          subtitle("Conversion measurement"),
          p("The public conversion endpoint records only valid event IDs, a controlled event name/type, optional experiment ID, and clean source path. It is cookie-free and does not collect a visitor identity. The dashboard distinguishes unverified client signals from server-side checkout or paid-conversion events."),
          simple_table(["Event", "Use", "Reliability"], [
              ["cta_click", "Interest in a CTA or offer", "Client-side directional signal; may be blocked or repeated."],
              ["inquiry_submitted", "Contact form completed", "Client-side attribution plus server-side inbound ledger when genuine."],
              ["checkout_started", "Buyer reached paid flow", "Server/payment-flow measurement."],
              ["paid_conversion", "Paid event reconciled", "Highest-confidence revenue signal."],
          ], [1.6*inch, 2.6*inch, 2.9*inch]),
          subtitle("Operating an experiment"),
          bullet("Record a source reference, hypothesis, target URL, one intended change, CTA, baseline KPI/value/date, and a 14-28-day measurement date."),
          bullet("Publish the actual page change yourself. The experiment record neither writes content nor deploys the site."),
          bullet("After the measurement date, compare like-for-like Search Console timeframe and conversion events. Keep a winner, revise a weak test, or retire it. Avoid declaring success from a few impressions or a single click."),
          subtitle("Privacy posture"),
          bullet("Public MPS usage HMACs a visitor fingerprint to enforce quota; it does not store input text or its hash."),
          bullet("The conversion layer does not use cookies or collect identity. Inbound and agent ledgers do contain operationally necessary identity/contact data and must remain private."),
          bullet("The revenue dashboard intentionally queries only PII-free inbound data. Use the inbound queue when a human actually needs contact details."), Spacer(1, 0.16*inch)]

# Recurring routine
story += [title("12. Operator cadence"),
          subtitle("Daily - 15 to 30 minutes"),
          simple_table(["Check", "Action"], [
              ["Qualified inbound", "Open /admin/inbound. Handle defined, timely inquiries first. Request missing decision context manually; route self-service buyers to the correct product URL."],
              ["Payments and errors", "Check Stripe events/webhook health. Investigate 4xx/5xx in Vercel logs. Never compensate a failed payment by editing database tables."],
              ["Market Scout", "Review any queued evidence. Archive, reject, or start review based on source quality and buyer intent. Low scores are valid evidence of insufficient demand, not errors."],
              ["Email", "Respond personally to genuine inquiries and prospects. Record outcomes in the respective private queue only after they occur."],
          ], [1.65*inch, 5.2*inch]),
          subtitle("Weekly - 60 to 90 minutes"),
          simple_table(["Check", "Action"], [
              ["Demand and utility tests", "Cluster corroborated signals; evaluate economics; advance only one clear validation. Confirm current utility test status and paid-order progress."],
              ["Content", "Review one or two real reader questions. Use assistants to prepare drafts, then verify sources and release only score-qualified, genuinely useful pages."],
              ["Revenue dashboard", "Review gross/refund/net, delivery states, and abnormal refunds. Confirm reconciliation agrees with Stripe."],
              ["Outbound", "Review prospects, edit approved drafts, send manually where appropriate, and record actual replies/wins/losses."],
          ], [1.65*inch, 5.2*inch]),
          subtitle("Monthly - 2 to 3 hours"),
          simple_table(["Check", "Action"], [
              ["Experiment review", "Measure experiments that reached their date. Retain, iterate, or retire based on the stated KPI and confidence, not motivation."],
              ["Search visibility", "Import new Search Console data; identify page-one-adjacent queries and improve existing content with answer, sources, navigation, and CTA."],
              ["Security", "Rotate compromised tokens; verify Turnstile and Stripe webhook configurations; review service-role access; check Vercel deployments and database migration history."],
              ["Cost and pricing", "Compare utility variable cost, operating cost, and refunds against actual payment data before changing price or scale."],
          ], [1.65*inch, 5.2*inch]),
          callout("RECOMMENDED FOCUS", "For the current $5-$10 automated-revenue objective: operate the Demand Gate -> SOM -> Experiment -> Micro-utility-validation path. Do not build another utility until a validated cluster and conservative economics justify it. The existing receipt-to-CSV path is the current test vehicle."), Spacer(1, 0.16*inch)]

# Incidents
story += [title("13. Incident and support runbooks"),
          simple_table(["Situation", "Correct response", "Do not do"], [
              ["MPS customer has zero credits", "The API should return 402 before model work. Send the purchaser to /mps/audit-access or perform an audited credit adjustment only after verification.", "Do not bypass billingDecision or run the model manually for an insolvent credential."],
              ["Audit processing fails", "Confirm idempotent failed-audit refund entry. If needed, use MPS Operations append-only credit correction with ticket/reference.", "Do not edit the credit ledger directly."],
              ["Lost API credential", "Use lookup, then credential replacement action. Securely transmit new plaintext once; old credential is revoked.", "Do not expect to recover original plaintext from database/logs."],
              ["Stripe event replay/out of order", "Allow webhook idempotency/retry path to resolve. Inspect exact event ID and purchase reference.", "Do not manually add balance for every webhook delivery."],
              ["Utility auto-refund uncertain", "The route returns 502 when Stripe refund or database confirmation remains unsettled. Recheck Stripe and run state before notifying buyer.", "Do not claim refunded until both sides are confirmed."],
              ["Contact spam", "Ensure Turnstile keys/site hostnames configured. Let screen-out response remain generic. Check Vercel logs for systematic abuse.", "Do not create a sales record or reply to generic SEO/backlink solicitation."],
              ["Content score withheld", "Read red checklist items, revise private draft, recalculate. Verify sources manually.", "Do not lower the threshold or fabricate artifact/source details to pass."],
              ["Production page/source correction", "Use publication amendment workflow with complete replacement source package and exact confirmation.", "Do not overwrite immutable original publication audit record."],
          ], [1.25*inch, 3.1*inch, 2.75*inch]),
          subtitle("Useful diagnostic locations"),
          bullet("Vercel: deployment status, build logs, runtime route errors, environment variables, and cron invocation history."),
          bullet("Stripe: Events, webhook delivery attempts, Checkout sessions, refunds, disputes, and live/test mode separation."),
          bullet("Supabase: migration history, SQL logs, and read-only inspection. Use application operations endpoints for audited business mutations whenever one exists."),
          bullet("Resend: delivery logs for qualified inbound/agent notices and sender-domain verification."),
          bullet("Google Search Console: query/page performance and URL Inspection; Bing Webmaster Tools: sitemap coverage and crawler discovery."), Spacer(1, 0.16*inch)]

# Migration map
story += [title("14. Schema and migration map"),
          p("The repository currently contains migrations for credentials, MPS records, rate limiting, prepaid credit ledger, webhooks, book entitlement/payment, revenue control/reconciliation, inbound gatekeeper/operations, utilities, market mapping, content workflow, experiments, privacy-safe conversion measurement, outbound CRM, demand validation, SOM economics, micro-utility validation, and contact qualification. The database must be in lockstep with this directory."),
          simple_table(["Area", "Representative migrations", "Notes"], [
              ["Agent/MPS core", "20260716000000 through 20260718001300", "Agent inquiry/credentials, audit jobs, public audit usage, credits, Stripe idempotency, MPS operations."],
              ["Books & paid products", "20260718001400; 20260718001500; 20260720001600-18", "Entitlements, book checkout/replay/reversals, self-service book access."],
              ["Revenue & inbound", "20260720001900-21; 20260720003200; 20260722023000", "Revenue events/reconciliation, inbound gatekeeper/queue, contact qualification and attribution."],
              ["Utilities", "20260720003000-31; 20260721010000", "Public usage, paid pipeline, receipt image uploads."],
              ["Discovery/content", "20260721003300; 20260721010200-16", "Market mapping, Scout quality, search feedback, candidate/draft/handoff/publication/amendment workflow."],
              ["Growth & sales", "20260721010400; 20260722010000; 20260722020000-04", "Experiments, conversion measurement, outbound, sales metrics, demand/SOM/utility validation."],
          ], [1.55*inch, 2.75*inch, 2.8*inch]),
          subtitle("Safe migration procedure"),
          bullet("Check <font name='Courier'>git status</font> and ensure the migration folder matches the intended branch. Do not delete historical migration files simply because a feature was removed; repair history deliberately if a remote version is no longer local."),
          bullet("Run <font name='Courier'>supabase db push</font> against the linked target. If the CLI reports remote versions not found locally, stop: use the specific repair/pull direction from the CLI before continuing."),
          bullet("Deploy only after migration succeeds. Then smoke-test the protected admin route, public route, webhook signature endpoint in test mode, and one end-to-end product flow."),
          callout("NO DIRECT LEDGER EDITS", "For credit adjustments, credential revocation/replacement, revenue outcomes, inbound operations, outbound stages, experiments, and content releases, prefer the application route/UI because it enforces authorization, validation, idempotency, state transitions, and an audit record."), Spacer(1, 0.16*inch)]

# Checklist
story += [title("15. Launch-readiness checklist"),
          subtitle("Baseline platform"),
          bullet("Supabase URL/service role configured; all migrations applied; no migration-history mismatch."),
          bullet("Vercel Production deployment green; CRON_SECRET configured; cron logs checked after first scheduled run."),
          bullet("Resend sender domain verified; inbound notification recipient is private and correct."),
          bullet("Separate private tokens generated and stored in Vercel only."),
          subtitle("Commerce"),
          bullet("Live Stripe prices created; exact IDs mapped in the correct product variable; each webhook route has a distinct verified endpoint and secret."),
          bullet("Feature flags remain false until test payment, delivery, replay, partial refund, full refund, and support path have passed."),
          bullet("MPS 402 happens before Anthropic work; internal credentials are confirmed to retain meter-only behavior."),
          subtitle("Growth and demand"),
          bullet("Search Console sitemap submitted/import route verified; Exa key and Market Scout sources configured only when ready for its controlled, read-only daily run."),
          bullet("No custom legacy Scout query variable inadvertently overrides the desired rotating matrix."),
          bullet("At least one experiment includes a baseline, a concrete change, source reference, target page, CTA, KPI, and a realistic measure-after date."),
          subtitle("Content and trust"),
          bullet("Turnstile installed on root and www; server validation active; contact spam does not enter the sales ledger."),
          bullet("At least one full content workflow completed with genuine source metadata, limitations, artifact, score >=70, and explicit human release."),
          bullet("Amendment workflow tested on a non-critical source package if the editorial process will be used regularly."),
          subtitle("First full round"),
          p("1. Run/import discovery signals. 2. Human-review and approve only direct demand. 3. Form one demand cluster. 4. Evaluate conservative economics. 5. Create one experiment and, if warranted, one micro-utility validation. 6. Publish the specific human-approved page/change. 7. Track visitors/checkout/purchase for 14-28 days. 8. Reconcile payment and decide retain, iterate, or retire."),
          Spacer(1, .20*inch), callout("FINAL REMINDER", "The system can make revenue operations more disciplined, observable, and scalable. It cannot guarantee demand. The decisive inputs are still a real buyer problem, a credible offer, distribution, trusted execution, and your human judgment about when the evidence is sufficient.")]

doc = BaseDocTemplate(str(OUT), pagesize=letter, rightMargin=0.7*inch, leftMargin=0.7*inch, topMargin=0.65*inch, bottomMargin=0.58*inch, title="Maha Strategies Infrastructure & Operations Handbook", author="Maha Strategies LLC")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=header_footer)])
doc.build(story)
print(OUT)
