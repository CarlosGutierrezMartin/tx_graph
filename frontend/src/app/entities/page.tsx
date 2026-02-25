"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";
import Section from "@/components/Section";

export default function EntitiesPage() {
  const [q, setQ] = useState("iberia");
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState("");

  async function search() {
    setErr("");
    try {
      const data = await apiGet(`/entities/search?q=${encodeURIComponent(q)}`);
      setRes(data);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div className="grid">
      <Section title="Entity search" right={<button className="btn" onClick={search}>Search</button>}>
        <div className="row">
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {err && <p className="small" style={{ color: "salmon" }}>{err}</p>}
        <div style={{ marginTop: 12 }}>
          <pre>{res ? JSON.stringify(res, null, 2) : "Search for a counterparty/account…"}</pre>
        </div>
      </Section>

      <Section title="Tip">
        <p className="small">
          Use this to find an entity key, then paste it into <b>Graph explorer</b>.
        </p>
      </Section>
    </div>
  );
}