"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import Section from "@/components/Section";
import SeverityPill from "@/components/SeverityPill";

type Cluster = {
  entity_kind: string;
  entity_key: string;
  rule_id: string;

  severity: string;
  alerts_count: number;
  occurrences: number;

  oldest_created_at?: string | null;
  last_seen_at?: string | null;
  latest_canonical_event_id?: number | null;

  case_id?: number | null;

  sla?: {
    available: boolean;
    age_minutes?: number;
    ack_target_minutes?: number;
    resolve_target_minutes?: number;
    breach_ack?: boolean;
    breach_resolve?: boolean;
    sla_breached?: boolean;
  };
};

function minutesAgo(iso?: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 60000));
}

function fmtMins(m: number | null): string {
  if (m === null) return "—";
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

export default function AlertClustersPage() {
  const [status, setStatus] = useState("open");
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    try {
      const data = await apiGet<{ clusters: Cluster[] }>(
        `/alerts/clusters?status=${encodeURIComponent(status)}&limit=100`
      );
      setClusters(data.clusters || []);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    load();
  }, [status]);

  return (
    <div className="grid">
      <Section title="Alert clusters" right={<button className="btn" onClick={load}>Refresh</button>}>
        <div className="row">
          <span className="small">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="open">open</option>
            <option value="acked">acked</option>
            <option value="resolved">resolved</option>
          </select>
          <span className="pill">count: {clusters.length}</span>
        </div>

        {err && <p className="small" style={{ color: "salmon" }}>{err}</p>}

        <div style={{ marginTop: 12 }}>
          {clusters.map((c) => {
            const lastSeenMins = minutesAgo(c.last_seen_at ?? null);
            const ageMins = typeof c.sla?.age_minutes === "number" ? c.sla.age_minutes : null;
            const breached = !!c.sla?.sla_breached;

            const href =
              `/alerts/cluster?entity_kind=${encodeURIComponent(c.entity_kind)}` +
              `&entity_key=${encodeURIComponent(c.entity_key)}` +
              `&rule_id=${encodeURIComponent(c.rule_id)}` +
              `&status=${encodeURIComponent(status)}`;

            return (
              <a key={`${c.entity_kind}:${c.entity_key}:${c.rule_id}`} href={href}>
                <div className="card cardTight" style={{ marginBottom: 10 }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div className="row">
                      <SeverityPill severity={c.severity} />
                      {breached && <span className="pill pillBreach">SLA breached</span>}
                      {ageMins !== null && <span className="pill">age: {fmtMins(ageMins)}</span>}
                      {lastSeenMins !== null && (
                        <span className="pill">last seen: {fmtMins(lastSeenMins)} ago</span>
                      )}
                      <span className="pill">alerts: {c.alerts_count}</span>
                      <span className="pill">occ: {c.occurrences}</span>
                      {c.case_id && <span className="pill">case: {c.case_id}</span>}
                    </div>

                    <span className="small">{c.rule_id}</span>
                  </div>

                  <div style={{ marginTop: 8, fontWeight: 720 }}>
                    {c.entity_kind}: {c.entity_key}
                  </div>

                  <div className="small" style={{ marginTop: 8 }}>
                    latest event: {c.latest_canonical_event_id ?? "n/a"}
                  </div>
                </div>
              </a>
            );
          })}

          {clusters.length === 0 && (
            <div className="small" style={{ padding: 10 }}>
              No clusters found. Generate events in <b>Ingest (dev)</b>.
            </div>
          )}
        </div>
      </Section>

      <Section title="How to demo clusters">
        <ol className="small" style={{ marginTop: 0 }}>
          <li>Go to <b>Ingest (dev)</b> and send 3–5 events for the same counterparty.</li>
          <li>Open <b>Clusters</b>: you’ll see a single cluster with <b>x occurrences</b> and <b>last seen</b>.</li>
          <li>Click the cluster → drilldown shows all alerts + latest investigation + graph.</li>
        </ol>
      </Section>
    </div>
  );
}