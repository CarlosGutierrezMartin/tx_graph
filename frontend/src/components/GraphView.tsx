"use client";

import CytoscapeComponent from "react-cytoscapejs";

type GraphNode = { id: number; labels: string[]; properties: Record<string, any> };
type GraphEdge = { id: number; type: string; start: number; end: number; properties: Record<string, any> };

export type GraphPayload = { nodes: GraphNode[]; edges: GraphEdge[] };

function nodeLabel(n: GraphNode) {
  const p = n.properties || {};
  const key = p.name ?? p.account_id ?? p.canonical_event_id ?? n.id;
  return `${(n.labels?.[0] ?? "Node")}: ${key}`;
}

function nodeColor(n: GraphNode) {
  const l = (n.labels?.[0] ?? "").toLowerCase();
  if (l === "account") return "rgba(111,160,255,.9)";
  if (l === "counterparty") return "rgba(191,255,55,.85)";
  if (l === "transaction") return "rgba(230,220,255,.85)";
  return "rgba(255,255,255,.75)";
}

export default function GraphView({ graph }: { graph: GraphPayload }) {
  const elements = [
    ...(graph.nodes ?? []).map((n) => ({
      data: { id: String(n.id), label: nodeLabel(n), color: nodeColor(n) },
    })),
    ...(graph.edges ?? []).map((e) => ({
      data: { id: String(e.id), source: String(e.start), target: String(e.end), label: e.type },
    })),
  ];

  return (
    <div className="card" style={{ height: 560 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b>Graph</b>
        <span className="pill">
          nodes: {graph.nodes?.length ?? 0} · edges: {graph.edges?.length ?? 0}
        </span>
      </div>

      <div style={{ height: 500, marginTop: 12 }}>
        <CytoscapeComponent
          elements={elements as any}
          style={{ width: "100%", height: "100%" }}
          layout={{ name: "cose", animate: true } as any}
          stylesheet={[
            {
              selector: "node",
              style: {
                "background-color": "data(color)",
                label: "data(label)",
                "font-size": 10,
                "text-wrap": "wrap",
                "text-max-width": 160,
                color: "rgba(255,255,255,.92)",
                "text-outline-width": 2,
                "text-outline-color": "rgba(0,0,0,.45)",
              } as any,
            },
            {
              selector: "edge",
              style: {
                label: "data(label)",
                "font-size": 9,
                color: "rgba(255,255,255,.65)",
                width: 1.4,
                "line-color": "rgba(255,255,255,.20)",
                "target-arrow-shape": "triangle",
                "target-arrow-color": "rgba(255,255,255,.22)",
                "curve-style": "bezier",
              } as any,
            },
          ]}
        />
      </div>
    </div>
  );
}