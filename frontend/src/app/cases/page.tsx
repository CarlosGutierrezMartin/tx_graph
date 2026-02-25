"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import Section from "@/components/Section";
import SeverityPill from "@/components/SeverityPill";

type CaseItem = {
  id: number;
  severity: string;
  status: string;
  title: string;
  canonical_event_id?: number | null;
  entity_kind?: string | null;
  entity_key?: string | null;
  created_at: string;
};

export default function CasesPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    try {
      const data = await apiGet<{ cases: CaseItem[] }>("/cases?limit=100");
      setCases(data.cases || []);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="grid">
      <Section title="Cases" right={<button className="btn" onClick={load}>Refresh</button>}>
        {err && <p className="small" style={{ color: "salmon" }}>{err}</p>}
        <div style={{ marginTop: 12 }}>
          {cases.map((c) => (
            <a key={c.id} href={`/cases/${c.id}`}>
              <div className="card cardTight" style={{ marginBottom: 10 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="row">
                    <SeverityPill severity={c.severity} />
                    <span className="pill">{c.status}</span>
                  </div>
                  <span className="small">#{c.id}</span>
                </div>

                <div style={{ marginTop: 8, fontWeight: 700 }}>{c.title}</div>
                <div className="small" style={{ marginTop: 8 }}>
                  event: {c.canonical_event_id ?? "n/a"} · {c.entity_kind}:{c.entity_key}
                </div>
              </div>
            </a>
          ))}
          {cases.length === 0 && <p className="small">No cases found.</p>}
        </div>
      </Section>

      <Section title="What reviewers should notice">
        <ul className="small" style={{ marginTop: 0 }}>
          <li>Cases store a structured evidence pack (signals + narrative + graph summary).</li>
          <li>Alerts → investigations → create case is one coherent workflow.</li>
          <li>Notes and status updates mimic real ops tooling.</li>
        </ul>
      </Section>
    </div>
  );
}