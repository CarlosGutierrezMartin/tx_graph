"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPostJson } from "@/lib/api";
import Section from "@/components/Section";
import SeverityPill from "@/components/SeverityPill";
import SignalViz from "@/components/SignalViz";
import Toast, { ToastTone } from "@/components/Toast";

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

type Alert = any;

type Timeline = {
  canonical_event_id: number;
  suggested_severity: string;
  signals: any;
  recommended_actions: string[];
  narrative: string[];
  graph_context: any;
};

function minutesAgo(iso?: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 60000));
}

function fmtMins(m: number | null | undefined): string {
  if (m === null || m === undefined) return "—";
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

function keyOf(c: Cluster) {
  return `${c.entity_kind}::${c.entity_key}::${c.rule_id}`;
}

function isoPlusMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60_000).toISOString();
}

function uid(prefix = "evt") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function ClustersPage() {
  const [status, setStatus] = useState("open");
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [err, setErr] = useState("");

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<Cluster | null>(null);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // toast
  const [toastOpen, setToastOpen] = useState(false);
  const [toastTone, setToastTone] = useState<ToastTone>("info");
  const [toastMsg, setToastMsg] = useState("");

  const showToast = (tone: ToastTone, message: string) => {
    setToastTone(tone);
    setToastMsg(message);
    setToastOpen(true);
  };

  const clustersUrl = useMemo(
    () => `/alerts/clusters?status=${encodeURIComponent(status)}&limit=120`,
    [status]
  );

  async function loadClusters() {
    setErr("");
    try {
      const data = await apiGet<{ clusters: Cluster[] }>(clustersUrl);
      const list = data.clusters || [];
      setClusters(list);

      if (list.length > 0) {
        const stillThere = selectedKey && list.some((c) => keyOf(c) === selectedKey);
        const next = stillThere ? list.find((c) => keyOf(c) === selectedKey)! : list[0];
        setSelectedKey(keyOf(next));
        setSelected(next);
      } else {
        setSelectedKey(null);
        setSelected(null);
        setAlerts([]);
        setTimeline(null);
      }
    } catch (e: any) {
      setErr(e.message);
      showToast("error", e.message);
    }
  }

  async function loadPreview(c: Cluster) {
    setLoadingPreview(true);
    setErr("");
    try {
      // 1) alerts in cluster
      const qs = new URLSearchParams();
      qs.set("entity_kind", c.entity_kind);
      qs.set("entity_key", c.entity_key);
      qs.set("rule_id", c.rule_id);
      qs.set("status", status);
      qs.set("limit", "400");

      const data = await apiGet<{ alerts: Alert[] }>(`/alerts/cluster?${qs.toString()}`);
      const list = data.alerts || [];
      setAlerts(list);

      // 2) timeline based on latest event id
      const eventId =
        c.latest_canonical_event_id ??
        list[list.length - 1]?.latest_canonical_event_id ??
        list[list.length - 1]?.payload?.canonical_event_id ??
        list[list.length - 1]?.canonical_event_id ??
        null;

      if (eventId) {
        const t = await apiGet<Timeline>(`/investigations/transactions/${eventId}/timeline?days=30`);
        setTimeline(t);
      } else {
        setTimeline(null);
      }
    } catch (e: any) {
      setErr(e.message);
      setTimeline(null);
      setAlerts([]);
      showToast("error", e.message);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function ackOneOpen() {
    const open = alerts.find((a) => a.status === "open");
    if (!open) return showToast("info", "No open alert in this cluster");
    try {
      await apiPost(`/alerts/${open.id}/ack?actor=analyst_1`);
      showToast("success", `Acked alert #${open.id}`);
      await loadClusters();
      if (selected) await loadPreview(selected);
    } catch (e: any) {
      showToast("error", e.message);
    }
  }

  async function resolveOne() {
    // resolve the newest non-resolved in cluster for demo simplicity
    const target =
      [...alerts].reverse().find((a) => a.status !== "resolved") ??
      alerts[alerts.length - 1];

    if (!target) return showToast("info", "No alert to resolve");
    try {
      await apiPost(`/alerts/${target.id}/resolve?actor=analyst_1`);
      showToast("success", `Resolved alert #${target.id}`);
      await loadClusters();
      if (selected) await loadPreview(selected);
    } catch (e: any) {
      showToast("error", e.message);
    }
  }

  async function generateDemoCritical() {
    setErr("");
    try {
      setStatus("open");

      const base = new Date();
      const payloads = [
        { minutes: 0, amount: 45.0 },
        { minutes: 2, amount: 47.0 },
        { minutes: 4, amount: 48.0 },
        { minutes: 6, amount: 999.0 },
      ];

      for (let i = 0; i < payloads.length; i++) {
        const p = payloads[i];
        await apiPostJson("/ingest", {
          source: "sandbox_transfer",
          idempotency_key: uid("evt_cluster_demo"),
          payload: {
            event_type: "TRANSFER_OUT",
            occurred_at: isoPlusMinutes(base, p.minutes),
            amount: p.amount,
            currency: "EUR",
            account_id: "acct_demo_001",
            counterparty_name: "Supplier Iberia SL",
          },
        });
      }

      showToast("info", "Demo events sent. Waiting for worker…");

      // poll a bit
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < 8; i++) {
        await sleep(900);
        const data = await apiGet<{ clusters: Cluster[] }>(`/alerts/clusters?status=open&limit=120`);
        if ((data.clusters || []).length > 0) break;
      }

      await loadClusters();
      showToast("success", "Cluster inbox updated ✅");
    } catch (e: any) {
      setErr(e.message);
      showToast("error", e.message);
    }
  }

  // load clusters on start & when status changes
  useEffect(() => {
    loadClusters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clustersUrl]);

  // load preview when selected cluster changes
  useEffect(() => {
    if (!selected) return;
    loadPreview(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  return (
    <>
      <Toast
        open={toastOpen}
        message={toastMsg}
        tone={toastTone}
        onClose={() => setToastOpen(false)}
      />

      <div className="grid">
        {/* LEFT: cluster inbox */}
        <div>
          <Section title="Clusters" right={<button className="btn" onClick={loadClusters}>Refresh</button>}>
            <div className="row">
              <span className="small">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="open">open</option>
                <option value="acked">acked</option>
                <option value="resolved">resolved</option>
              </select>
              <span className="pill">count {clusters.length}</span>
              <a className="btn" href="/alerts">Go to alerts</a>
            </div>

            {err && <p className="small" style={{ color: "salmon" }}>{err}</p>}

            <div style={{ marginTop: 14 }}>
              {clusters.length === 0 ? (
                <div className="card cardTight" style={{ boxShadow: "none" }}>
                  <div style={{ fontWeight: 850, fontSize: 16 }}>No clusters</div>
                  <div className="small" style={{ marginTop: 6 }}>
                    Generate a demo critical cluster to populate the inbox.
                  </div>
                  <div className="row" style={{ marginTop: 12 }}>
                    <button className="btn btnPrimary" onClick={generateDemoCritical}>
                      Generate demo critical
                    </button>
                    <a className="btn" href="/ingest">Open ingest tool</a>
                  </div>
                </div>
              ) : (
                clusters.map((c) => {
                  const isSelected = selectedKey === keyOf(c);
                  const lastSeenMins = minutesAgo(c.last_seen_at ?? null);
                  const ageMins = typeof c.sla?.age_minutes === "number" ? c.sla.age_minutes : null;
                  const breached = !!c.sla?.sla_breached;

                  return (
                    <div
                      key={keyOf(c)}
                      className="card cardTight"
                      style={{
                        boxShadow: "none",
                        marginBottom: 10,
                        cursor: "pointer",
                        borderColor: isSelected ? "rgba(19,38,253,.45)" : undefined,
                        background: isSelected ? "rgba(19,38,253,.10)" : undefined,
                      }}
                      onClick={() => {
                        setSelectedKey(keyOf(c));
                        setSelected(c);
                      }}
                    >
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <div className="row">
                          <SeverityPill severity={c.severity} />
                          {breached && <span className="pill pillBreach">SLA breached</span>}
                          {ageMins !== null && <span className="pill">age: {fmtMins(ageMins)}</span>}
                          {lastSeenMins !== null && (
                            <span className="pill">last seen: {fmtMins(lastSeenMins)} ago</span>
                          )}
                        </div>
                        <span className="pill">{c.rule_id}</span>
                      </div>

                      <div style={{ marginTop: 8, fontWeight: 780 }}>
                        {c.entity_kind}: {c.entity_key}
                      </div>

                      <div className="small" style={{ marginTop: 8 }}>
                        alerts: {c.alerts_count}
                        {" · "}occ: {c.occurrences}
                        {" · "}latest event: {c.latest_canonical_event_id ?? "n/a"}
                        {" · "}case: {c.case_id ?? "none"}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Section>
        </div>

        {/* RIGHT: cluster preview */}
        <div>
          <Section
            title="Cluster preview"
            right={
              selected ? (
                <a
                  className="btn"
                  href={
                    `/alerts/cluster?entity_kind=${encodeURIComponent(selected.entity_kind)}` +
                    `&entity_key=${encodeURIComponent(selected.entity_key)}` +
                    `&rule_id=${encodeURIComponent(selected.rule_id)}` +
                    `&status=${encodeURIComponent(status)}`
                  }
                >
                  Open full
                </a>
              ) : (
                <span className="pill">select a cluster</span>
              )
            }
          >
            {!selected && (
              <div className="small">
                Select a cluster to preview underlying alerts + latest investigation.
              </div>
            )}

            {selected && (
              <>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="row">
                    <SeverityPill severity={selected.severity} />
                    {selected.sla?.sla_breached && <span className="pill pillBreach">SLA breached</span>}
                    <span className="pill">alerts {selected.alerts_count}</span>
                    <span className="pill">occ {selected.occurrences}</span>
                    {selected.case_id && <a className="pill" href={`/cases/${selected.case_id}`}>case #{selected.case_id}</a>}
                  </div>
                  <span className="pill">{selected.rule_id}</span>
                </div>

                <div style={{ marginTop: 10, fontWeight: 850, fontSize: 18 }}>
                  {selected.entity_kind}: {selected.entity_key}
                </div>

                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn" onClick={ackOneOpen}>Ack one open</button>
                  <button className="btn" onClick={resolveOne}>Resolve one</button>
                  <a className="btn" href="/graph">Open graph explorer</a>
                </div>

                {loadingPreview && (
                  <div className="small" style={{ marginTop: 12 }}>
                    Loading cluster details…
                  </div>
                )}

                {!loadingPreview && timeline && (
                  <>
                    <SignalViz signals={timeline.signals} sla={selected.sla} />

                    <div className="card" style={{ marginTop: 16 }}>
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <b>Alerts inside cluster</b>
                        <span className="pill">oldest → newest</span>
                      </div>

                      <div style={{ marginTop: 12 }}>
                        {alerts.map((a) => (
                          <a key={a.id} href={`/alerts/${a.id}`}>
                            <div className="card cardTight" style={{ boxShadow: "none", marginBottom: 10 }}>
                              <div className="row" style={{ justifyContent: "space-between" }}>
                                <div className="row">
                                  <SeverityPill severity={a.severity} />
                                  <span className="pill">{a.status}</span>
                                  {a.sla?.sla_breached && <span className="pill pillBreach">SLA breached</span>}
                                  {typeof a.sla?.age_minutes === "number" && (
                                    <span className="pill">age {fmtMins(a.sla.age_minutes)}</span>
                                  )}
                                </div>
                                <span className="small">#{a.id}</span>
                              </div>
                              <div style={{ marginTop: 8, fontWeight: 650 }}>{a.title}</div>
                              <div className="small" style={{ marginTop: 6 }}>
                                event: {a.canonical_event_id ?? "n/a"} · latest: {a.latest_canonical_event_id ?? "n/a"} · case:{" "}
                                {a.case_id ?? "none"}
                              </div>
                            </div>
                          </a>
                        ))}
                        {alerts.length === 0 && <div className="small">No alerts returned for this cluster.</div>}
                      </div>

                      <details style={{ marginTop: 10 }}>
                        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Recommended actions</summary>
                        <ul className="small" style={{ marginTop: 10 }}>
                          {(timeline.recommended_actions || []).map((x, i) => <li key={i}>{x}</li>)}
                        </ul>
                      </details>

                      <details style={{ marginTop: 10 }}>
                        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Narrative</summary>
                        <ul className="small" style={{ marginTop: 10 }}>
                          {timeline.narrative?.map((n, i) => <li key={i}>{n}</li>)}
                        </ul>
                      </details>
                    </div>
                  </>
                )}

                {!loadingPreview && !timeline && (
                  <div className="small" style={{ marginTop: 12 }}>
                    No timeline available (missing latest event id).
                  </div>
                )}
              </>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}