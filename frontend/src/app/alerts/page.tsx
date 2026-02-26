"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPostJson } from "@/lib/api";
import Section from "@/components/Section";
import SeverityPill from "@/components/SeverityPill";
import SignalViz from "@/components/SignalViz";
import Toast, { ToastTone } from "@/components/Toast";

type Alert = {
  id: number;
  severity: string;
  status: string;
  title: string;
  description?: string | null;

  entity_kind: string;
  entity_key: string;

  canonical_event_id?: number | null;
  latest_canonical_event_id?: number | null;
  case_id?: number | null;

  occurrences?: number;
  last_seen_at?: string | null;

  payload?: any;

  sla?: {
    available: boolean;
    age_minutes?: number;
    ack_target_minutes?: number;
    resolve_target_minutes?: number;
    time_to_ack_minutes?: number | null;
    time_to_resolve_minutes?: number | null;
    breach_ack?: boolean;
    breach_resolve?: boolean;
    sla_breached?: boolean;
  };
};

type Timeline = {
  canonical_event_id: number;
  suggested_severity: string;
  signals: any;
  recommended_actions: string[];
  narrative: string[];
  graph_context: any;
  event?: any;
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

function mean(nums: number[]) {
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function isoPlusMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60_000).toISOString();
}

function extractEventId(a: Alert | null): number | null {
  if (!a) return null;
  const fromFields =
    a.latest_canonical_event_id ??
    a.canonical_event_id ??
    a.payload?.canonical_event_id ??
    null;
  const n = Number(fromFields);
  return Number.isFinite(n) ? n : null;
}

export default function AlertsPage() {
  // filters
  const [status, setStatus] = useState("open");
  const [severity, setSeverity] = useState<string>("");

  // data
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [err, setErr] = useState("");

  // selection + preview
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ alert: Alert; timeline: Timeline | null } | null>(null);
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

  const qs = useMemo(() => {
    const q = new URLSearchParams();
    q.set("status", status);
    if (severity) q.set("severity", severity);
    q.set("limit", "100");
    return q.toString();
  }, [status, severity]);

  async function load() {
    setErr("");
    try {
      const data = await apiGet<{ alerts: Alert[] }>(`/alerts?${qs}`);
      const list = data.alerts || [];
      setAlerts(list);

      if (list.length > 0) {
        const stillThere = selectedId && list.some((a) => a.id === selectedId);
        const nextId = stillThere ? selectedId : list[0].id;
        setSelectedId(nextId);
      } else {
        setSelectedId(null);
        setPreview(null);
      }
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function loadPreviewById(id: number) {
    const a = alerts.find((x) => x.id === id);
    if (!a) return;

    setLoadingPreview(true);
    try {
      const eventId = extractEventId(a);
      let timeline: Timeline | null = null;

      if (eventId) {
        timeline = await apiGet<Timeline>(`/investigations/transactions/${eventId}/timeline?days=30`);
      }
      setPreview({ alert: a, timeline });
    } catch (e: any) {
      setErr(e.message);
      setPreview({ alert: a, timeline: null });
    } finally {
      setLoadingPreview(false);
    }
  }

  async function ack(id: number) {
    setErr("");
    try {
      await apiPost(`/alerts/${id}/ack?actor=analyst_1`);
      showToast("success", `Alert #${id} acked`);
      await load();
    } catch (e: any) {
      setErr(e.message);
      showToast("error", e.message);
    }
  }

  async function resolve(id: number) {
    setErr("");
    try {
      await apiPost(`/alerts/${id}/resolve?actor=analyst_1`);
      showToast("success", `Alert #${id} resolved`);
      await load();
    } catch (e: any) {
      setErr(e.message);
      showToast("error", e.message);
    }
  }

  async function createCase(id: number) {
    setErr("");
    try {
      const res = await apiPost<any>(`/alerts/${id}/create-case?actor=analyst_1`);
      showToast("success", `Case action done for alert #${id}`);
      window.alert(`create-case:\n${JSON.stringify(res, null, 2)}`);
      await load();
    } catch (e: any) {
      setErr(e.message);
      showToast("error", e.message);
    }
  }

  async function generateDemoCritical() {
    setErr("");
    try {
      // ensure visible filters
      setStatus("open");
      setSeverity("");

      const base = new Date();
      const runId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

      const payloads = [
        { minutes: 0, amount: 45.0 },
        { minutes: 2, amount: 47.0 },
        { minutes: 4, amount: 48.0 },
        { minutes: 6, amount: 999.0 },
      ];

      // snapshot to detect “dedup update” (occurrences/last_seen) vs “new row”
      const before = await apiGet<{ alerts: Alert[] }>(`/alerts?status=open&limit=100`);
      const beforeMap = new Map(
        (before.alerts || []).map((a) => [
          `${a.entity_kind}:${a.entity_key}:${a.id}`,
          { occ: a.occurrences ?? 1, last: a.last_seen_at ?? "" },
        ])
      );

      for (let i = 0; i < payloads.length; i++) {
        const p = payloads[i];
        await apiPostJson("/ingest", {
          source: "sandbox_transfer",
          idempotency_key: `evt_demo_${runId}_${i}`,
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

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      let ok = false;

      for (let attempt = 0; attempt < 10; attempt++) {
        await sleep(900);
        const after = await apiGet<{ alerts: Alert[] }>(`/alerts?status=open&limit=100`);
        const list = after.alerts || [];

        // new inbox
        if (list.length > 0 && (before.alerts || []).length === 0) ok = true;

        // updated in-place
        for (const a of list) {
          const key = `${a.entity_kind}:${a.entity_key}:${a.id}`;
          const prev = beforeMap.get(key);
          const occ = a.occurrences ?? 1;
          const last = a.last_seen_at ?? "";
          if (!prev) {
            ok = true;
            break;
          }
          if (occ !== prev.occ || last !== prev.last) {
            ok = true;
            break;
          }
        }

        if (ok) break;
      }

      await load();

      if (ok) {
        showToast("success", "Demo cluster updated ✅ (check x-occurrences / last seen)");
      } else {
        const msg =
          "Demo events sent, but no alert update detected yet. Check worker logs and try Refresh.";
        setErr(msg);
        showToast("error", msg);
      }
    } catch (e: any) {
      setErr(e.message);
      showToast("error", e.message);
    }
  }

  // initial load + refresh on filters
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  // preview loads when selection changes
  useEffect(() => {
    if (selectedId) loadPreviewById(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, alerts]);

  // KPI tiles (based on current list)
  const breached = alerts.filter((a) => a.sla?.sla_breached).length;
  const critical = alerts.filter((a) => (a.severity || "").toLowerCase() === "critical").length;
  const ages = alerts
    .map((a) => (typeof a.sla?.age_minutes === "number" ? a.sla.age_minutes : null))
    .filter((x): x is number => x !== null);
  const avgAge = mean(ages);

  return (
    <>
      <Toast
        open={toastOpen}
        message={toastMsg}
        tone={toastTone}
        onClose={() => setToastOpen(false)}
      />

      <div className="grid">
        {/* LEFT: inbox */}
        <div>
          <Section title="Alerts" right={<button className="btn" onClick={load}>Refresh</button>}>
            <div className="row">
              <span className="small">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="open">open</option>
                <option value="acked">acked</option>
                <option value="resolved">resolved</option>
              </select>

              <span className="small">Severity</span>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="">(all)</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
                <option value="critical">critical</option>
              </select>

              <span className="pill">count {alerts.length}</span>
            </div>

            {err && <p className="small" style={{ color: "salmon" }}>{err}</p>}

            {/* KPI tiles */}
            <div
              style={{
                marginTop: 14,
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              {[
                { label: "Open", value: alerts.length, tone: "pill" },
                { label: "Breached", value: breached, tone: breached > 0 ? "pill pillBreach" : "pill" },
                { label: "Critical", value: critical, tone: critical > 0 ? "pill pillCritical" : "pill" },
                { label: "Avg age", value: avgAge === null ? "—" : `${avgAge}m`, tone: "pill" },
              ].map((k) => (
                <div key={k.label} className="card cardTight" style={{ boxShadow: "none" }}>
                  <div className="small">{k.label}</div>
                  <div style={{ marginTop: 6, fontWeight: 850, fontSize: 18 }}>{k.value}</div>
                  <div style={{ marginTop: 8 }}>
                    <span className={k.tone as string}>triage</span>
                  </div>
                </div>
              ))}
            </div>

            {/* List / Empty state */}
            <div style={{ marginTop: 14 }}>
              {alerts.length === 0 ? (
                <div className="card cardTight" style={{ boxShadow: "none" }}>
                  <div style={{ fontWeight: 850, fontSize: 16 }}>Inbox is clear</div>
                  <div className="small" style={{ marginTop: 6 }}>
                    No alerts match your filters. Generate a critical cluster in one click.
                  </div>

                  <div className="row" style={{ marginTop: 12 }}>
                    <button className="btn btnPrimary" onClick={generateDemoCritical}>
                      Generate demo critical
                    </button>
                    <a className="btn" href="/ingest">Open ingest tool</a>
                    <a className="btn" href="/alerts/clusters">View clusters</a>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <details>
                      <summary style={{ cursor: "pointer", fontWeight: 700 }}>What this generates</summary>
                      <div className="small" style={{ marginTop: 8 }}>
                        4 payments to the same counterparty in &lt;10 minutes; last one is a large outlier → critical.
                        If an alert already exists, it will be <b>updated</b> (x-occurrences + last seen), not duplicated.
                      </div>
                    </details>
                  </div>
                </div>
              ) : (
                alerts.map((a) => {
                  const age = a.sla?.available ? a.sla.age_minutes : undefined;
                  const breached = !!a.sla?.sla_breached;
                  const lastSeenMins = minutesAgo(a.last_seen_at ?? null);
                  const isSelected = selectedId === a.id;

                  return (
                    <div
                      key={a.id}
                      className="card cardTight"
                      style={{
                        boxShadow: "none",
                        marginBottom: 10,
                        cursor: "pointer",
                        borderColor: isSelected ? "rgba(19,38,253,.45)" : undefined,
                        background: isSelected ? "rgba(19,38,253,.10)" : undefined,
                      }}
                      onClick={() => setSelectedId(a.id)}
                    >
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <div className="row">
                          <SeverityPill severity={a.severity} />
                          <span className="pill">{a.status}</span>
                          {typeof age === "number" && <span className="pill">age: {fmtMins(age)}</span>}
                          {breached && <span className="pill pillBreach">SLA breached</span>}
                          {typeof a.occurrences === "number" && a.occurrences > 1 && (
                            <span className="pill">x{a.occurrences}</span>
                          )}
                          {lastSeenMins !== null && (
                            <span className="pill">last seen: {fmtMins(lastSeenMins)} ago</span>
                          )}
                        </div>

                        <div className="row">
                          {a.status === "open" && (
                            <button
                              className="btn"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                ack(a.id);
                              }}
                            >
                              Ack
                            </button>
                          )}
                          <span className="small">#{a.id}</span>
                        </div>
                      </div>

                      <div style={{ marginTop: 8, fontWeight: 700 }}>{a.title}</div>
                      <div className="small" style={{ marginTop: 8 }}>
                        {a.entity_kind}: {a.entity_key}
                        {" · "}event: {a.canonical_event_id ?? "n/a"}
                        {" · "}latest: {a.latest_canonical_event_id ?? "n/a"}
                        {" · "}case: {a.case_id ?? "none"}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* SLA policy collapsible */}
            <div style={{ marginTop: 14 }}>
              <details>
                <summary style={{ cursor: "pointer", fontWeight: 700 }}>SLA policy</summary>
                <ul className="small" style={{ marginTop: 10 }}>
                  <li><b>critical</b>: ack ≤ 5m, resolve ≤ 60m</li>
                  <li><b>high</b>: ack ≤ 15m, resolve ≤ 240m</li>
                  <li><b>medium</b>: ack ≤ 60m, resolve ≤ 1440m</li>
                </ul>
              </details>
            </div>
          </Section>
        </div>

        {/* RIGHT: preview panel */}
        <div>
          <Section
            title="Preview"
            right={
              preview?.alert ? (
                <a className="btn" href={`/alerts/${preview.alert.id}`}>Open full</a>
              ) : (
                <span className="pill">select an alert</span>
              )
            }
          >
            {!preview?.alert && (
              <div className="small">
                Select an alert to see investigation signals, actions, and narrative here.
              </div>
            )}

            {preview?.alert && (
              <>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="row">
                    <SeverityPill severity={preview.alert.severity} />
                    <span className="pill">{preview.alert.status}</span>
                    {preview.alert.sla?.sla_breached && <span className="pill pillBreach">SLA breached</span>}
                    {preview.alert.case_id && (
                      <a className="pill" href={`/cases/${preview.alert.case_id}`}>case #{preview.alert.case_id}</a>
                    )}
                  </div>

                  <span className="pill">
                    {preview.alert.entity_kind}: {preview.alert.entity_key}
                  </span>
                </div>

                <div style={{ marginTop: 10, fontWeight: 850, fontSize: 18 }}>
                  {preview.alert.title}
                </div>

                <div className="row" style={{ marginTop: 12 }}>
                  <button
                    className="btn"
                    onClick={() => ack(preview.alert.id)}
                    disabled={preview.alert.status !== "open"}
                  >
                    Ack
                  </button>
                  <button className="btn" onClick={() => resolve(preview.alert.id)}>
                    Resolve
                  </button>
                  <button className="btn btnPrimary" onClick={() => createCase(preview.alert.id)}>
                    Create case
                  </button>
                  <a className="btn" href="/alerts/clusters">Go to clusters</a>
                </div>

                {loadingPreview && <div className="small" style={{ marginTop: 12 }}>Loading investigation…</div>}

                {!loadingPreview && preview.timeline && (
                  <>
                    <SignalViz signals={preview.timeline.signals} sla={preview.alert.sla} />

                    <div className="card" style={{ marginTop: 16 }}>
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <b>Recommended actions</b>
                        <span className="pill">top</span>
                      </div>
                      <ul className="small" style={{ marginTop: 10 }}>
                        {(preview.timeline.recommended_actions || []).slice(0, 3).map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>

                      <details style={{ marginTop: 12 }}>
                        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Narrative</summary>
                        <ul className="small" style={{ marginTop: 10 }}>
                          {preview.timeline.narrative?.map((n, i) => <li key={i}>{n}</li>)}
                        </ul>
                      </details>

                      <details style={{ marginTop: 10 }}>
                        <summary style={{ cursor: "pointer", fontWeight: 700 }}>View raw</summary>
                        <div style={{ marginTop: 10 }}>
                          <pre>{JSON.stringify({ alert: preview.alert, timeline: preview.timeline }, null, 2)}</pre>
                        </div>
                      </details>
                    </div>
                  </>
                )}

                {!loadingPreview && preview.timeline === null && (
                  <div className="small" style={{ marginTop: 12 }}>
                    No timeline available for this alert (missing canonical_event_id).
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