"use client";

import { useState } from "react";
import { apiPostJson } from "@/lib/api";
import Section from "@/components/Section";

function makeTemplate() {
  const uid = `evt_ui_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ts = new Date().toISOString();
  return `{
  "source": "sandbox_transfer",
  "idempotency_key": "${uid}",
  "payload": {
    "event_type": "TRANSFER_OUT",
    "occurred_at": "${ts}",
    "amount": 999.0,
    "currency": "EUR",
    "account_id": "acct_demo_001",
    "counterparty_name": "Supplier Iberia SL"
  }
}`;
}

export default function IngestPage() {
  const [json, setJson] = useState(makeTemplate);
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