"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import Section from "@/components/Section";
import SeverityPill from "@/components/SeverityPill";

type Alert = {
  id: number;
  severity: string;
  status: string;
  title: string;
  entity_kind: string;
  entity_key: string;
  canonical_event_id?: number | null;
  case_id?: number | null;
  created_at: string;
};

export default function AlertsPage() {
  const [status, setStatus] = useState("open");
  const [severity, setSeverity] = useState<string>("");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [err, setErr] = useState("");

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
      setAlerts(data.alerts || []);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  useEffect(() => { load(); }, [qs]);

  return (
    <div className="grid">
      <Section
        title="Alerts"
        right={<button className="btn" onClick={load}>Refresh</button>}
      >
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

          <span className="pill">count: {alerts.length}</span>
        </div>

        {err && <p className="small" style={{ color: "salmon" }}>{err}</p>}

        <div style={{ marginTop: 12 }}>
          {alerts.map((a) => (
            <a key={a.id} href={`/alerts/${a.id}`}>
              <div className="card cardTight" style={{ marginBottom: 10 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="row">
                    <SeverityPill severity={a.severity} />
                    <span className={`pill ${
                      a.status === "open" ? "pillOpen" :
                      a.status === "acked" ? "pillAcked" : "pillResolved"
                    }`}>{a.status}</span>
                  </div>
                  <span className="small">#{a.id}</span>
                </div>

                <div style={{ marginTop: 8, fontWeight: 650 }}>{a.title}</div>
                <div className="small" style={{ marginTop: 8 }}>
                  {a.entity_kind}: {a.entity_key}
                  {" · "}event: {a.canonical_event_id ?? "n/a"}
                  {" · "}case: {a.case_id ?? "none"}
                </div>
              </div>
            </a>
          ))}
          {alerts.length === 0 && (
            <div className="small" style={{ padding: 10 }}>
              No alerts found. Use <b>Ingest (dev)</b> to generate one.
            </div>
          )}
        </div>
      </Section>

      <Section title="Demo script (what to click)">
        <ol className="small" style={{ marginTop: 0 }}>
          <li>Generate an event in <b>Ingest (dev)</b>.</li>
          <li>Open an alert → you’ll see timeline + signals + graph.</li>
          <li>Ack / Resolve / Create case directly from the alert detail page.</li>
          <li>Go to <b>Cases</b> → add notes and update status/severity.</li>
        </ol>
      </Section>
    </div>
  );
}