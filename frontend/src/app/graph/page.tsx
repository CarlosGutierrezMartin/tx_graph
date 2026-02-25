"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";
import Section from "@/components/Section";
import GraphView, { GraphPayload } from "@/components/GraphView";

export default function GraphExplorer() {
  const [kind, setKind] = useState("counterparty");
  const [key, setKey] = useState("Supplier Iberia SL");
  const [hops, setHops] = useState(2);
  const [graph, setGraph] = useState<GraphPayload>({ nodes: [], edges: [] });
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    try {
      const data = await apiGet<GraphPayload>(
        `/graph/neighborhood?kind=${encodeURIComponent(kind)}&key=${encodeURIComponent(key)}&hops=${hops}`
      );
      setGraph(data);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div className="grid">
      <Section title="Graph explorer" right={<button className="btn btnPrimary" onClick={load}>Load</button>}>
        <div className="row">
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="counterparty">counterparty</option>
            <option value="account">account</option>
            <option value="transaction">transaction</option>
          </select>
          <input className="input" value={key} onChange={(e) => setKey(e.target.value)} />
          <input
            className="input"
            style={{ maxWidth: 110 }}
            type="number"
            value={hops}
            onChange={(e) => setHops(Number(e.target.value))}
          />
        </div>
        {err && <p className="small" style={{ color: "salmon" }}>{err}</p>}
        <p className="small" style={{ marginTop: 10 }}>
          Example: kind=counterparty, key=Supplier Iberia SL, hops=2
        </p>
      </Section>

      <GraphView graph={graph} />
    </div>
  );
}