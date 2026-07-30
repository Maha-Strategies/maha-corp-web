from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageBreak, PageTemplate, Paragraph, Spacer, Table,
    TableStyle,
)


ROOT = Path('/Users/mayonerajan/Projects/maha-corp-web')
OUTPUT = ROOT / 'output/pdf/maha-strategies-infrastructure-report-2026-07-30.pdf'

NAVY = colors.HexColor('#101827')
BLUE = colors.HexColor('#0B7285')
CYAN = colors.HexColor('#0EA5A6')
SLATE = colors.HexColor('#475569')
LIGHT = colors.HexColor('#EEF4F8')
LINE = colors.HexColor('#CBD5E1')
GREEN = colors.HexColor('#166534')
AMBER = colors.HexColor('#92400E')
RED = colors.HexColor('#991B1B')


def esc(text):
    return (text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='CoverKicker', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=CYAN, spaceAfter=14, uppercase=True, tracking=1.3))
styles.add(ParagraphStyle(name='CoverTitle', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=31, leading=36, textColor=NAVY, spaceAfter=15))
styles.add(ParagraphStyle(name='CoverSub', parent=styles['Normal'], fontName='Helvetica', fontSize=13, leading=19, textColor=SLATE, spaceAfter=18))
styles.add(ParagraphStyle(name='H1Maha', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=20, leading=25, textColor=NAVY, spaceBefore=2, spaceAfter=12))
styles.add(ParagraphStyle(name='H2Maha', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=12, leading=16, textColor=BLUE, spaceBefore=9, spaceAfter=6))
styles.add(ParagraphStyle(name='BodyMaha', parent=styles['BodyText'], fontName='Helvetica', fontSize=9.4, leading=14, textColor=NAVY, spaceAfter=7))
styles.add(ParagraphStyle(name='SmallMaha', parent=styles['BodyText'], fontName='Helvetica', fontSize=8, leading=11, textColor=SLATE, spaceAfter=5))
styles.add(ParagraphStyle(name='TableMaha', parent=styles['BodyText'], fontName='Helvetica', fontSize=7.3, leading=10, textColor=NAVY))
styles.add(ParagraphStyle(name='TableHeader', parent=styles['BodyText'], fontName='Helvetica-Bold', fontSize=7.4, leading=10, textColor=colors.white))
styles.add(ParagraphStyle(name='Callout', parent=styles['BodyText'], fontName='Helvetica-Bold', fontSize=10, leading=14, textColor=NAVY))


def P(text, style='BodyMaha'):
    return Paragraph(esc(text), styles[style])


def Rich(text, style='BodyMaha'):
    return Paragraph(text, styles[style])


def section(title, body=None):
    items = [P(title, 'H1Maha')]
    if body:
        items.append(P(body))
    return items


def bullet(text):
    return Rich(f'<bullet>&bull;</bullet>{esc(text)}', 'BodyMaha')


def make_table(headers, rows, widths):
    data = [[Paragraph(esc(cell), styles['TableHeader']) for cell in headers]]
    for row in rows:
        data.append([Paragraph(esc(cell), styles['TableMaha']) for cell in row])
    table = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.35, LINE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT]),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    return table


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(doc.leftMargin, 0.52 * inch, letter[0] - doc.rightMargin, 0.52 * inch)
    canvas.setFont('Helvetica', 7.5)
    canvas.setFillColor(SLATE)
    canvas.drawString(doc.leftMargin, 0.34 * inch, 'Maha Strategies LLC | Infrastructure state report | 30 July 2026')
    canvas.drawRightString(letter[0] - doc.rightMargin, 0.34 * inch, f'Page {doc.page}')
    canvas.restoreState()


def cover_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(CYAN)
    canvas.rect(0, 0, letter[0], 0.18 * inch, fill=1, stroke=0)
    canvas.restoreState()


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(
        str(OUTPUT), pagesize=letter,
        rightMargin=0.62 * inch, leftMargin=0.62 * inch,
        topMargin=0.60 * inch, bottomMargin=0.75 * inch,
        title='Maha Strategies LLC - Infrastructure State Report',
        author='Maha Strategies LLC',
        subject='Repository-derived infrastructure and capability summary',
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='body')
    doc.addPageTemplates([
        PageTemplate(id='cover', frames=[frame], onPage=cover_footer),
        PageTemplate(id='body', frames=[frame], onPage=footer),
    ])

    story = []
    story.append(Spacer(1, 1.05 * inch))
    story.append(P('Maha Strategies LLC', 'CoverKicker'))
    story.append(P('Infrastructure State Report', 'CoverTitle'))
    story.append(P('Repository-derived overview of the commercial platform, research proof layer, developer tooling, security controls, and operational dependencies.', 'CoverSub'))
    cover_table = Table([
        [P('REPORT DATE', 'SmallMaha'), P('SCOPE', 'SmallMaha')],
        [P('30 July 2026', 'Callout'), P('Implemented repository surfaces and their stated release boundaries', 'Callout')],
    ], colWidths=[1.65 * inch, 4.7 * inch])
    cover_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.5, LINE),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10), ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 9), ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
    ]))
    story += [Spacer(1, 0.36 * inch), cover_table, Spacer(1, 0.45 * inch)]
    story.append(P('Assessment basis', 'H2Maha'))
    story.append(P('This report is based on the local Next.js application source, contracts, tests, and configuration reviewed on 30 July 2026. It is not a penetration test, financial audit, or independent measurement of production performance. Product outcome statements remain workload-specific and require customer benchmark acceptance criteria.'))
    story.append(Spacer(1, 0.6 * inch))
    story.append(P('Operating model', 'H2Maha'))
    story.append(P('Maha operates a dual-domain model: mahastrategies.com provides commercial product and API surfaces, while research.mahastrategies.com provides citations, structured claims, and mathematical context. The two are connected through research URLs, provenance references, and machine-readable metadata.'))
    story.append(PageBreak())
    doc.handle_nextPageTemplate('body')

    story += section('1. Executive state', 'The repository contains a broad, integrated platform rather than a single landing-page estate: research atlas modules, commercial optimization products, authenticated APIs, provenance tooling, context middleware, an MCP control layer, and developer-adoption assets are all present.')
    status_rows = [
        ('Commercial product surfaces', 'Implemented', 'Five product pages with calculators, research links, canonical metadata, and SoftwareApplication JSON-LD.'),
        ('Research proof layer', 'Implemented', 'Atlas modules, structured source and claim records, static claim routes, and llms.txt manifest.'),
        ('API and key platform', 'Implemented with active operational follow-up', 'Upstash-backed API keys, credit accounting, CORS, OpenAPI, SDK, CLI, and selected v1 endpoints.'),
        ('Payments', 'Implemented contract', 'Stripe webhook verification, credit-pack mapping, and idempotent crediting are present; production configuration remains an operator responsibility.'),
        ('Quality gates', 'Validated locally', 'Latest local checks: TypeScript compile passed; node test suite passed 161 tests. Deployment validation remains required after each production change.'),
    ]
    story.append(make_table(['Area', 'State', 'Evidence / boundary'], status_rows, [1.48*inch, 1.25*inch, 3.63*inch]))
    story.append(P('Current release note', 'H2Maha'))
    story.append(P('The latest key-service investigation identified and corrected a Redis HGETALL response-normalization issue. Production should be redeployed with that source change, then rechecked with a newly issued key. Temporary diagnostic logging should be disabled once the balance endpoint returns 200, because raw header dumps can expose internal platform metadata.'))
    story.append(P('Architecture at a glance', 'H2Maha'))
    arch = Table([
        [P('Research proof layer', 'TableHeader'), P('Commercial and developer layer', 'TableHeader'), P('Operations and controls', 'TableHeader')],
        [P('Atlas modules\nClaim ledger and citations\nStatic claim pages\nllms.txt manifest', 'TableMaha'), P('Product pages and calculators\nOpenAPI v3.1 and v1 APIs\nSDK, CLI, provenance widget\nContext compiler and MCP surfaces', 'TableMaha'), P('Vercel / Next.js 16\nUpstash Redis credits and rate limits\nStripe payment events\nOpenAI-compatible upstream proxy', 'TableMaha')],
    ], colWidths=[2.15*inch, 2.35*inch, 1.86*inch])
    arch.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,0), NAVY), ('GRID', (0,0), (-1,-1), .4, LINE), ('BACKGROUND', (0,1), (-1,1), LIGHT), ('VALIGN',(0,0),(-1,-1),'TOP'), ('LEFTPADDING',(0,0),(-1,-1),7), ('RIGHTPADDING',(0,0),(-1,-1),7), ('TOPPADDING',(0,0),(-1,-1),7), ('BOTTOMPADDING',(0,0),(-1,-1),7)]))
    story.append(arch)
    story.append(PageBreak())

    story += section('2. Product portfolio and capability surfaces')
    product_rows = [
        ('Maha Tensor-Opt', 'GPU-native QUBO / Ising optimization workflow with declared tensor-network parameters and benchmark framing.', 'research.mahastrategies.com/atlas/tensor-networks'),
        ('Maha Geometric AI', 'Symmetry-aware neural-network positioning for geometry-bound physics and engineering work, with declared invariance assumptions.', 'research.mahastrategies.com/atlas/geometric-ai'),
        ('Maha QEC-Compiler', 'Hardware-agnostic holographic QEC code-synthesis and fault-tolerant layout-planning surface.', 'research.mahastrategies.com/atlas/holographic-qec'),
        ('Maha Landscape-Opt', 'Topology-aware high-dimensional constraint search for EDA, logistics, and multi-agent optimization.', 'research.mahastrategies.com/atlas/landscape-opt'),
        ('Context Compiler', 'Deterministic, source-linked Context Packs with byte/token estimates and visible budget exclusions.', 'mahastrategies.com/context-compiler'),
        ('Enterprise MCP Gateway', 'Tenant-scoped registered MCP server inventory, method/tool allowlists, and privacy-preserving audit records.', 'mahastrategies.com/enterprise-mcp-gateway'),
    ]
    story.append(make_table(['Product', 'Implemented capability', 'Proof / interface'], product_rows, [1.32*inch, 3.45*inch, 1.59*inch]))
    story.append(P('Commercial engagement boundaries', 'H2Maha'))
    story.append(P('The commercial surfaces are deliberately bounded. Tensor-Opt is framed around declared acceptance tests rather than blanket quantum-advantage claims. Geometric AI validates declared constraints, not universal scientific correctness. QEC overhead reduction is a planning scenario, not a guarantee. Landscape-Opt reports residuals and workload-specific outcomes rather than claiming universal global optimality.'))
    story.append(P('Interactive demand-generation surfaces', 'H2Maha'))
    for text in [
        'Token Cost and Payload Estimator: local-first byte and approximate-token calculations, provider cost estimates, simulated compression scenarios, and API key CTA.',
        'Bulk Log ROI Auditor: browser parsing of JSONL / JSON traces with capped upload handling and planning-level enterprise ROI outputs.',
        'Per-product ROI calculators: Tensor-Opt, Geometric AI, Holographic QEC, and Landscape-Opt pages expose scenario planning rather than production performance promises.',
    ]: story.append(bullet(text))
    story.append(PageBreak())

    story += section('3. Research, provenance, and discoverability', 'The research domain is designed to anchor commercial propositions in citable, structured material instead of unlinked landing-page copy.')
    research_rows = [
        ('Atlas ledgers', 'Typed source and claim modules for tensor networks, geometric AI, holographic QEC, and landscape optimization. Catalog and aggregate integrity checks connect modules.'),
        ('Claim ingestion', 'scripts/expand-graph.ts ingests Markdown, LaTeX, and JSON from research-source into typed MPS claim data.'),
        ('Claim publishing', 'Static /claims/[slug] pages use build-time parameters, citation sections, related-claim links, canonical metadata, and TechArticle / DefinedTerm JSON-LD.'),
        ('Crawler manifest', '/llms.txt dynamically provides active claim summaries and useful API endpoints in text form for AI crawlers.'),
        ('Attribution widget', 'A zero-runtime-dependency public widget renders a provenance badge that links external content back to the claim URL.'),
    ]
    story.append(make_table(['Capability', 'Infrastructure status'], research_rows, [1.6*inch, 4.76*inch]))
    story.append(P('SEO and schema posture', 'H2Maha'))
    story.append(P('Commercial product pages use canonical paths and a single SoftwareApplication node with BusinessApplication and operating-system metadata. Research pages use TechArticle and DefinedTermSet / DefinedTerm relationships pointing to the organization and named-person identifiers. The intentional exclusion of unsold Product schema avoids invalid rich-result requirements.'))
    story.append(P('Content quality safeguard', 'H2Maha'))
    story.append(P('The ingestion pipeline stores claim status as VERIFIED, SOURCED, ILLUSTRATIVE, or UNVERIFIED. Related-claim linking and citations reduce orphaned, repetitive, or context-free pages. The remaining governance requirement is editorial review of every new source before publication; automation alone cannot establish scientific validity.'))
    story.append(PageBreak())

    story += section('4. API platform, developer tooling, and AI middleware')
    api_rows = [
        ('OpenAPI contracts', 'OpenAPI 3.1 registry covers optimization endpoints and documents request/response schemas.'),
        ('Optimization APIs', 'v1 mock job contracts for Tensor-Opt, Geometric AI, Holographic QEC, and Landscape-Opt return accepted execution payloads and research citations.'),
        ('Maha API keys', 'No-password key issuance with a credit ledger, tier metadata, rate limits, zero-data-retention flag, and a one-time raw-key response.'),
        ('MahaClient SDK', 'Zero-dependency TypeScript client using native fetch, typed errors, and exponential retry for 429 responses across Node, Bun, Deno, browser, and Edge runtimes.'),
        ('CLI', 'Audit local Markdown / TXT for estimated prompt-token savings and issue a key from the terminal; JSON output is designed for CI consumption.'),
        ('OpenAI-compatible proxy', 'Non-streaming Chat Completions proxy accepts standard payloads, compacts eligible text history, forwards to OpenAI, and preserves upstream response bodies.'),
    ]
    story.append(make_table(['Surface', 'Current capability'], api_rows, [1.55*inch, 4.81*inch]))
    story.append(P('Context Pack controls', 'H2Maha'))
    story.append(P('The Context Compiler measures original and compiled bytes, estimated tokens, duplicate removal, and source coverage. It returns source references and hashes; the product page states that original documents are not stored. The chat proxy only compacts text-only historical messages and preserves multimodal and tool-call messages verbatim to avoid changing their semantics. Streaming is explicitly not supported in the current endpoint.'))
    story.append(P('MCP delivery boundary', 'H2Maha'))
    story.append(P('The Enterprise MCP Gateway routes JSON MCP messages only to registered public HTTPS upstreams. It has tenant binding, explicit method/tool allowlists, and logs method/outcome/request hash rather than request bodies. It intentionally excludes private upstream access, upstream credential storage, bearer-token forwarding, browser-originated authorization, and SSE streaming in this release.'))
    story.append(PageBreak())

    story += section('5. Security, billing, and operational dependencies')
    control_rows = [
        ('API authorization', 'Proxy requires a Bearer Maha API key for protected /api/v1 paths. Missing/invalid keys are 401; depleted keys are 402; unavailable authorization service is fail-closed 503.'),
        ('Key management exclusions', 'Only key generation, balance, and checkout routes bypass the primary key guard. CORS preflight is handled for browser SDK use.'),
        ('Redis implementation', 'Upstash REST URL and token are sanitized for stray quote/whitespace input. Key records use SHA-256-derived key:data:<hash> paths and Redis hash field normalization.'),
        ('Credit accounting', 'Generation seeds starter credit. Additional credit consumption and webhook crediting are implemented; Stripe completed events are signature-checked and deduplicated.'),
        ('Webhook resilience', 'Missing/invalid signatures return 400. Authenticated permanently malformed payloads are acknowledged to prevent retry storms, with operator logging.'),
        ('Payload controls', 'Token calculator caps interactive input at 1 MB. Chat proxy caps request payloads at 512 KB. Log audit client parsing is capped at 10 MB.'),
    ]
    story.append(make_table(['Control area', 'Implemented behavior'], control_rows, [1.62*inch, 4.74*inch]))
    story.append(P('External dependencies and required configuration', 'H2Maha'))
    dep_rows = [
        ('Vercel', 'Next.js deployment, middleware/proxy, Node serverless handlers, environment scopes, logs.'),
        ('Upstash Redis', 'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN: key records, credit balances, rate limiting, webhook deduplication.'),
        ('Stripe', 'STRIPE_SECRET_KEY and STRIPE_API_KEY_WEBHOOK_SECRET: prepaid credit checkout and verified webhook processing.'),
        ('OpenAI', 'OPENAI_API_KEY: upstream only for the OpenAI-compatible Chat Completions proxy.'),
        ('Node runtime', 'package.json declares Node >= 22.0.0 for local and deployment compatibility.'),
    ]
    story.append(make_table(['Dependency', 'Role'], dep_rows, [1.5*inch, 4.86*inch]))
    story.append(P('Privacy qualification', 'H2Maha'))
    story.append(P('API key metadata can carry zero_data_retention: true and several surfaces avoid source-text persistence. This is an application control, not a blanket guarantee covering all external processors. Any enterprise data-retention commitment must additionally account for Vercel, Upstash, Stripe, OpenAI, and the customer configuration in scope.'))
    story.append(PageBreak())

    story += section('6. Release readiness and next actions')
    story.append(P('Recommended production sequence', 'H2Maha'))
    steps = [
        ('1', 'Deploy the current Redis HGETALL normalization fix to production.'),
        ('2', 'Generate a fresh key and verify POST /api/v1/keys/generate returns 201 and GET /api/v1/keys/balance returns 200 with Authorization: Bearer <key>.'),
        ('3', 'Turn API_KEY_DIAGNOSTICS off and remove temporary header-level debug logging after the verification succeeds.'),
        ('4', 'Run the release gates in the deployment branch: npx tsc --noEmit, npm run lint, npm test, and npm run build.'),
        ('5', 'Use Stripe test-mode events to validate checkout metadata, one-time crediting, and malformed-payload operator alerts.'),
        ('6', 'Run a staged end-to-end OpenAI proxy test with a non-sensitive prompt, observing credit consumption and upstream error passthrough.'),
        ('7', 'Establish an editorial approval queue for generated research claims and maintain a source audit trail.'),
    ]
    step_data = [[P('STEP', 'TableHeader'), P('Action', 'TableHeader')]] + [[P(n, 'TableMaha'), P(t, 'TableMaha')] for n, t in steps]
    steps_table = Table(step_data, colWidths=[0.55*inch, 5.81*inch], repeatRows=1)
    steps_table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),NAVY), ('GRID',(0,0),(-1,-1),.35,LINE), ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,LIGHT]), ('VALIGN',(0,0),(-1,-1),'TOP'), ('LEFTPADDING',(0,0),(-1,-1),6), ('RIGHTPADDING',(0,0),(-1,-1),6), ('TOPPADDING',(0,0),(-1,-1),5), ('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    story.append(steps_table)
    story.append(P('Risk register summary', 'H2Maha'))
    risk_rows = [
        ('High', 'Secrets or internal headers emitted by temporary diagnostics.', 'Disable diagnostics after validation; never paste raw platform headers or keys into tickets or chat.'),
        ('High', 'Deployment environment drift across Vercel, Upstash, Stripe, and OpenAI.', 'Use scoped environment checklists and staging smoke tests before promotion.'),
        ('Medium', 'Overstated scientific or efficiency outcomes.', 'Keep benchmark conditions, source citations, and accepted performance boundaries on every engagement.'),
        ('Medium', 'Broad browser CORS policy for authenticated APIs.', 'Review production origin policy as SDK distribution and threat model mature.'),
        ('Medium', 'Automated research graph expansion without editorial review.', 'Gate publication by provenance status and human source validation.'),
    ]
    story.append(make_table(['Priority', 'Risk', 'Mitigation'], risk_rows, [0.65*inch, 2.25*inch, 3.46*inch]))
    story.append(Spacer(1, 0.18*inch))
    story.append(P('Conclusion', 'H2Maha'))
    story.append(P('Maha Strategies has the core ingredients of a credible research-to-commercial infrastructure: structured research evidence, product-specific commercial surfaces, developer interfaces, middleware controls, and a metered operating model. The immediate priority is operational: complete the API-key production smoke test after redeploying the Redis normalization fix, then remove debug instrumentation and execute the full release gate.'))

    doc.build(story)


if __name__ == '__main__':
    build()
    print(OUTPUT)
