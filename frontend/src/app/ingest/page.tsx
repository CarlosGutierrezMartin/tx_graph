"use client";

import { useState } from "react";
import { apiPostJson } from "@/lib/api";
import Section from "@/components/Section";

export default function IngestPage() {
  const [json, setJson] = useState(
`{
  "source": "sandbox_transfer",
  "idempotency_key": "evt_ui_0001",
  "payload": {
    "event_type": "TRANSFER_OUT",
    "occurred_at": "2026-02-24T16:00:00Z",
    "amount": 999.0,
    "currency": "EUR",
    "account_id": "acct_demo_001",
    "counterparty_name": "Supplier Iberia SL"
  }
}`
  );
  const [out, setOut] = useState<any>(null);
  const [err, setErr] = useState("");

  async function send() {
    setErr("");
    try {
      const body = JSON.parse(json);
      const res = await apiPostJson("/ingest", body);
      setOut(res);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div className="grid">
      <Section title="Ingest (dev)" right={<button className="btn btnPrimary" onClick={send}>POST /ingest</button>}>
        <p className="small" style={{ marginTop: 0 }}>
          Use this to generate alerts/cases quickly. Make sure <b>idempotency_key</b> is unique each time.
        </p>
        <textarea
          style={{
            width: "100%",
            minHeight: 340,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
          value={json}
          onChange={(e) => setJson(e.target.value)}
        />
        {err && <p className="small" style={{ color: "salmon" }}>{err}</p>}
      </Section>

      <Section title="Response">
        <pre>{out ? JSON.stringify(out, null, 2) : "Send an event…"}</pre>
        <p className="small" style={{ marginTop: 10 }}>
          Then go to <b>Alerts</b> and refresh.
        </p>
      </Section>
    </div>
  );
}