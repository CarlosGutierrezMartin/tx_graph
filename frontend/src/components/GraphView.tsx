"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import CytoscapeComponent from "react-cytoscapejs";

type GraphNode = { id: number; labels: string[]; properties: Record<string, any> };
type GraphEdge = { id: number; type: string; start: number; end: number; properties: Record<string, any> };

export type GraphPayload = { nodes: GraphNode[]; edges: GraphEdge[] };

/* ——— Colors per node type ——— */
const NODE_STYLES: Record<string, { bg: string; border: string }> = {
  account: { bg: "#0075EB", border: "#005BB5" },
  counterparty: { bg: "#34C759", border: "#28A745" },
  transaction: { bg: "#AF52DE", border: "#8E44AD" },
};
const DEFAULT_NODE = { bg: "#6E6E73", border: "#555" };

function getNodeStyle(n: GraphNode) {
  const label = (n.labels?.[0] ?? "").toLowerCase();
  return NODE_STYLES[label] ?? DEFAULT_NODE;
}

function nodeLabel(n: GraphNode) {
  const p = n.properties || {};
  const key = p.name ?? p.account_id ?? p.canonical_event_id ?? n.id;
  const type = n.labels?.[0] ?? "Node";
  const keyStr = String(key);
  const short = keyStr.length > 20 ? keyStr.slice(0, 18) + "…" : keyStr;
  return `${type}\n${short}`;
}

const LAYOUT_OPTIONS = {
  name: "cose",
  animate: true,
  animationDuration: 600,
  nodeRepulsion: 8000,
  idealEdgeLength: 120,
  edgeElasticity: 100,
  gravity: 0.3,
  numIter: 300,
  padding: 30,
  randomize: true,
  componentSpacing: 60,
  nestingFactor: 1.2,
} as any;

function buildStylesheet(showLabels: boolean) {
  return [
    {
      selector: "node",
      style: {
        "background-color": "data(bg)",
        "border-width": 2,
        "border-color": "data(border)",
        label: showLabels ? "data(label)" : "",
        "font-size": 9,
        "font-family": "'IBM Plex Mono', monospace",
        "font-weight": 500,
        "text-wrap": "wrap",
        "text-max-width": 120,
        "text-valign": "bottom",
        "text-margin-y": 6,
        color: "rgba(255,255,255,.75)",
        "text-outline-width": 0,
        width: 36,
        height: 36,
        "overlay-padding": 4,
        "transition-property": "background-color, border-color, width, height",
        "transition-duration": "0.15s",
      } as any,
    },
    {
      selector: "node:selected",
      style: {
        "border-width": 3,
        "border-color": "#0075EB",
        width: 44,
        height: 44,
        label: "data(label)",
        "font-size": 10,
        color: "rgba(255,255,255,.92)",
      } as any,
    },
    {
      selector: "node.hover",
      style: {
        width: 42,
        height: 42,
        "border-width": 3,
        label: "data(label)",
        "font-size": 9,
        color: "rgba(255,255,255,.85)",
      } as any,
    },
    {
      selector: "edge",
      style: {
        label: "",
        width: 1,
        "line-color": "rgba(255,255,255,.08)",
        "target-arrow-shape": "triangle",
        "target-arrow-color": "rgba(255,255,255,.10)",
        "curve-style": "bezier",
        opacity: 0.7,
      } as any,
    },
    {
      selector: "edge:selected",
      style: {
        width: 2.5,
        "line-color": "rgba(0,117,235,.50)",
        "target-arrow-color": "rgba(0,117,235,.50)",
        label: "data(label)",
        "font-size": 8,
        "font-family": "'IBM Plex Mono', monospace",
        color: "rgba(255,255,255,.55)",
        "text-rotation": "autorotate",
        "text-margin-y": -8,
        opacity: 1,
      } as any,
    },
  ];
}

type LayoutName = "cose" | "circle" | "grid" | "breadthfirst" | "concentric";

export default function GraphView({ graph }: { graph: GraphPayload }) {
  const cyRef = useRef<any>(null);
  const [layout, setLayout] = useState<LayoutName>("cose");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [showLabels, setShowLabels] = useState(false);

  const nodeCount = graph.nodes?.length ?? 0;
  const edgeCount = graph.edges?.length ?? 0;

  const elements = [
    ...(graph.nodes ?? []).map((n) => {
      const s = getNodeStyle(n);
      return {
        data: {
          id: String(n.id),
          label: nodeLabel(n),
          bg: s.bg,
          border: s.border,
          nodeType: (n.labels?.[0] ?? "Node").toLowerCase(),
          raw: n,
        },
      };
    }),
    ...(graph.edges ?? []).map((e) => ({
      data: {
        id: `e${e.id}`,
        source: String(e.start),
        target: String(e.end),
        label: e.type,
      },
    })),
  ];

  // Update stylesheet when showLabels changes
  useEffect(() => {
    if (cyRef.current) {
      cyRef.current.style(buildStylesheet(showLabels));
    }
  }, [showLabels]);

  const handleCy = useCallback((cy: any) => {
    cyRef.current = cy;

    cy.on("tap", "node", (evt: any) => {
      const data = evt.target.data();
      setSelectedNode(data.raw ?? null);
    });
    cy.on("tap", (evt: any) => {
      if (evt.target === cy) setSelectedNode(null);
    });
    cy.on("mouseover", "node", (evt: any) => {
      evt.target.addClass("hover");
      document.body.style.cursor = "pointer";
    });
    cy.on("mouseout", "node", (evt: any) => {
      evt.target.removeClass("hover");
      document.body.style.cursor = "default";
    });
  }, []);

  const runLayout = useCallback((name: LayoutName) => {
    setLayout(name);
    if (cyRef.current) {
      const layoutCfg = name === "cose"
        ? LAYOUT_OPTIONS
        : { name, animate: true, animationDuration: 400, padding: 30 };
      cyRef.current.layout(layoutCfg).run();
    }
  }, []);

  const fitGraph = useCallback(() => {
    if (cyRef.current) cyRef.current.fit(undefined, 30);
  }, []);

  // Auto-fit after initial render
  useEffect(() => {
    const t = setTimeout(() => {
      if (cyRef.current && nodeCount > 0) cyRef.current.fit(undefined, 30);
    }, 800);
    return () => clearTimeout(t);
  }, [nodeCount]);

  if (nodeCount === 0) {
    return (
      <div className="graphCard">
        <div className="graphHeader">
          <span className="graphHeaderTitle">Graph</span>
          <span className="pill">no data</span>
        </div>
        <div className="graphEmpty">Load a graph to visualize entity relationships.</div>
      </div>
    );
  }

  // Count node types for legend
  const typeCounts: Record<string, number> = {};
  for (const n of graph.nodes ?? []) {
    const t = (n.labels?.[0] ?? "Other").toLowerCase();
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }

  return (
    <div className="graphCard">
      {/* Header */}
      <div className="graphHeader">
        <span className="graphHeaderTitle">Entity Relationship Graph</span>
        <div className="row" style={{ gap: 6 }}>
          <span className="pill">{nodeCount} nodes</span>
          <span className="pill">{edgeCount} edges</span>
        </div>
      </div>

      {/* Legend + controls */}
      <div className="graphLegend" style={{ justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 14 }}>
          {Object.entries(NODE_STYLES).map(([key, s]) => (
            <div key={key} className="graphLegendItem">
              <div className="graphLegendDot" style={{ background: s.bg }} />
              {key} ({typeCounts[key] || 0})
            </div>
          ))}
        </div>
        <div className="row" style={{ gap: 4 }}>
          <button
            className={`btn ${showLabels ? "btnPrimary" : ""}`}
            style={{ padding: "4px 10px", fontSize: 11 }}
            onClick={() => setShowLabels((v) => !v)}
          >
            {showLabels ? "Labels ON" : "Labels OFF"}
          </button>
          {(["cose", "circle", "breadthfirst", "concentric", "grid"] as LayoutName[]).map((l) => (
            <button
              key={l}
              className={`btn ${layout === l ? "btnPrimary" : ""}`}
              style={{ padding: "4px 10px", fontSize: 11 }}
              onClick={() => runLayout(l)}
            >
              {l}
            </button>
          ))}
          <button
            className="btn"
            style={{ padding: "4px 10px", fontSize: 11 }}
            onClick={fitGraph}
          >
            fit
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="graphCanvas">
        <CytoscapeComponent
          elements={elements as any}
          style={{ width: "100%", height: "100%" }}
          layout={LAYOUT_OPTIONS}
          stylesheet={buildStylesheet(showLabels)}
          cy={handleCy}
        />
      </div>

      {/* Node inspector */}
      {selectedNode && (
        <div style={{
          padding: "14px 24px",
          borderTop: "1px solid var(--border)",
          background: "var(--surface)",
          fontSize: 13,
        }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>
              {selectedNode.labels?.[0] ?? "Node"} #{selectedNode.id}
            </span>
            <button className="btn" style={{ padding: "3px 10px", fontSize: 11 }} onClick={() => setSelectedNode(null)}>
              ✕
            </button>
          </div>
          <pre style={{ fontSize: 12, maxHeight: 160, overflow: "auto" }}>
            {JSON.stringify(selectedNode.properties, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}