import Link from "next/link";
import s from "./landing.module.css";

export const metadata = { title: "Transaction Intelligence Graph — Rev-celerator" };

const features = [
  {
    icon: "🔔",
    iconClass: s.iconAlerts,
    title: "Real-time Alert Inbox",
    desc: "Severity-aware alerts with SLA enforcement, automatic deduplication, and one-click triage — reducing mean-time-to-acknowledge under the five-minute critical SLA target.",
  },
  {
    icon: "🤖",
    iconClass: s.iconAI,
    title: "AI Investigation Copilot",
    desc: "LLM-powered evidence analysis that generates analyst-ready narratives, suggested actions, and confidence-scored case notes — accelerating investigation throughput by orders of magnitude.",
  },
  {
    icon: "🕸️",
    iconClass: s.iconGraph,
    title: "Graph Explorer",
    desc: "Interactive entity-relationship visualization powered by Neo4j. Traverse accounts, counterparties, and transactions across configurable hops to uncover hidden network patterns.",
  },
  {
    icon: "📋",
    iconClass: s.iconCases,
    title: "Case Management",
    desc: "End-to-end investigative workflow: alerts escalate into cases with structured evidence packs, analyst notes, and auditable status transitions — mirroring production-grade compliance tooling.",
  },
  {
    icon: "🔍",
    iconClass: s.iconEntity,
    title: "Entity Resolution & Search",
    desc: "Fuzzy search across accounts and counterparties with real-time graph lookups, enabling analysts to pivot between entity views and investigation contexts seamlessly.",
  },
  {
    icon: "📡",
    iconClass: s.iconIngest,
    title: "Event Ingest Pipeline",
    desc: "Idempotent JSON ingest with async worker processing, canonical event normalization, and automatic alert generation — demonstrating event-driven architecture at the data boundary.",
  },
];

const useCases = [
  {
    number: "01",
    title: "Rapid-fire Payment Detection",
    scenario: "4 outbound transfers to the same counterparty within 10 minutes, with the last one 20× larger than the median.",
    flow: ["Event ingested", "Velocity + outlier signals computed", "Critical alert raised", "SLA clock starts"],
    outcome: "Analyst receives a triageable alert in < 1 second with pre-computed evidence and recommended actions.",
    color: "var(--rv-alert-red)",
  },
  {
    number: "02",
    title: "Graph-based Network Discovery",
    scenario: "An account shows normal individual transactions, but graph traversal reveals it shares counterparties with 3 other flagged accounts.",
    flow: ["Entity search", "Graph neighborhood query", "Shared-node pattern detected", "Investigation opened"],
    outcome: "Hidden network relationships surfaced that single-transaction analysis would miss entirely.",
    color: "var(--rv-accent-purple)",
  },
  {
    number: "03",
    title: "AI-assisted Case Escalation",
    scenario: "A high-severity alert requires investigation. The AI copilot analyses velocity, outlier, and graph signals to draft a preliminary case.",
    flow: ["Alert selected", "AI analyses evidence pack", "Narrative + actions generated", "Case created with notes"],
    outcome: "Investigation time reduced from 30+ minutes of manual review to under 2 minutes with audit-ready documentation.",
    color: "var(--rv-deep-blue)",
  },
];

const tech = [
  "Next.js 16",
  "React 19",
  "FastAPI",
  "PostgreSQL",
  "Neo4j",
  "Ollama · Llama 3.1",
  "Docker Compose",
  "Cytoscape.js",
  "TypeScript",
];

export default function LandingPage() {
  return (
    <>
      {/* ── Header ──────────────────────────────────────── */}
      <header className={s.topHeader}>
        <div className={s.topHeaderLeft}>
          <div className={s.topHeaderName}>Carlos Gutiérrez Martín</div>
          <div className={s.topHeaderProject}>Rev-celerator · Transaction Intelligence Graph</div>
        </div>
        <div className={s.topHeaderSocials}>
          <a href="https://github.com/CarlosGutierrezMartin" target="_blank" rel="noopener noreferrer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" /></svg>
            GitHub
          </a>
          <a href="https://www.linkedin.com/in/carlos-gutiérrez-martín-2895481b7" target="_blank" rel="noopener noreferrer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124ZM6.849 20.452H3.838V9h3.011v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z" /></svg>
            LinkedIn
          </a>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────── */}
      <section className={s.hero}>
        <div className={s.heroContent}>
          <div className={s.badge}>Rev-celerator · Portfolio Prototype</div>

          <h1 className={s.headline}>
            Transaction Intelligence Graph
          </h1>

          <p className={s.tagline}>
            A full-stack operations console for financial transaction monitoring —
            from real-time alert triage and AI-assisted investigations to
            graph-based entity analysis and case management.
          </p>

          <div className={s.heroCtas}>
            <Link href="/alerts" className={s.ctaPrimary}>
              Enter Console <span aria-hidden>→</span>
            </Link>
            <a
              href="#features"
              className={s.ctaSecondary}
            >
              Explore Features
            </a>
          </div>
        </div>

        {/* Scroll arrow */}
        <a href="#features" className={s.scrollArrow} aria-label="Scroll to features">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14" />
            <path d="m19 12-7 7-7-7" />
          </svg>
        </a>
      </section>

      {/* ── Features ──────────────────────────────────── */}
      <section id="features" className={s.section}>
        <div className={s.sectionLabel}>Platform Capabilities</div>
        <h2 className={s.sectionTitle}>
          Built for operational excellence
        </h2>
        <p className={s.sectionSub}>
          Every module mirrors the workflows and data contracts of
          production FinCrime &amp; Ops tooling — designed to demonstrate
          end-to-end system thinking.
        </p>

        <div className={s.featuresGrid}>
          {features.map((f) => (
            <div key={f.title} className={s.featureCard}>
              <div className={`${s.featureIcon} ${f.iconClass}`}>
                {f.icon}
              </div>
              <div className={s.featureTitle}>{f.title}</div>
              <div className={s.featureDesc}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Use Cases ─────────────────────────────────── */}
      <section className={s.section}>
        <div className={s.sectionLabel}>Real-world Scenarios</div>
        <h2 className={s.sectionTitle}>How it works in practice</h2>
        <p className={s.sectionSub}>
          Three scenarios that demonstrate the end-to-end detection,
          investigation, and escalation workflow.
        </p>

        <div className={s.useCasesGrid}>
          {useCases.map((uc) => (
            <div key={uc.number} className={s.useCaseCard}>
              <div
                className={s.useCaseNumber}
                style={{ color: uc.color }}
              >
                {uc.number}
              </div>
              <h3 className={s.useCaseTitle}>{uc.title}</h3>
              <p className={s.useCaseScenario}>{uc.scenario}</p>

              <div className={s.useCaseFlow}>
                {uc.flow.map((step, i) => (
                  <div key={i} className={s.flowStep}>
                    <div className={s.flowDot} style={{ background: uc.color }} />
                    <span className={s.flowLabel}>{step}</span>
                    {i < uc.flow.length - 1 && (
                      <div className={s.flowLine} style={{ background: uc.color }} />
                    )}
                  </div>
                ))}
              </div>

              <div className={s.useCaseOutcome}>
                <span className={s.outcomeLabel}>Outcome</span>
                <span>{uc.outcome}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tech Stack ────────────────────────────────── */}
      <section className={s.techSection}>
        <div className={s.techLabel}>Technology Stack</div>
        <div className={s.techStrip}>
          {tech.map((t) => (
            <span key={t} className={s.techPill}>
              {t}
            </span>
          ))}
        </div>
      </section>

    </>
  );
}