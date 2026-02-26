"use client";

type Velocity = { count_10m?: number; count_1h?: number; count_24h?: number };
type Outlier =
  | {
      available: boolean;
      method?: "robust_z_mad" | "ratio_to_median";
      median?: number;
      mad?: number;
      robust_z?: number;
      ratio_to_median?: number;
      is_unusual?: boolean;
      is_outlier?: boolean;
      history_n?: number;
    }
  | { available: false };

type SLA = {
  available: boolean;
  age_minutes?: number;
  ack_target_minutes?: number;
  resolve_target_minutes?: number;
  breach_ack?: boolean;
  breach_resolve?: boolean;
  sla_breached?: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmtMins(m?: number | null): string {
  if (m === null || m === undefined) return "—";
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

function fmtNum(n?: number | null, digits = 2) {
  if (n === null || n === undefined) return "—";
  return Number(n).toFixed(digits);
}

function barWidth(value: number, capAt: number) {
  const pct = (clamp(value, 0, capAt) / capAt) * 100;
  return `${pct}%`;
}

function outlierScore(outlier: Outlier): number {
  if (!outlier || !("available" in outlier) || !outlier.available) return 0;
  if (typeof outlier.robust_z === "number") return clamp(Math.abs(outlier.robust_z), 0, 10);
  if (typeof outlier.ratio_to_median === "number") return clamp(Math.abs(outlier.ratio_to_median - 1) * 5, 0, 10);
  return 0;
}

function signalChips(velocity: Velocity, outlier: Outlier, sla?: SLA): string[] {
  const chips: string[] = [];

  if (typeof velocity.count_10m === "number") chips.push(`x${velocity.count_10m} in 10m`);
  if (typeof velocity.count_1h === "number") chips.push(`x${velocity.count_1h} in 1h`);
  if (typeof velocity.count_24h === "number") chips.push(`x${velocity.count_24h} in 24h`);

  if (outlier && "available" in outlier && outlier.available) {
    if (typeof outlier.robust_z === "number") chips.push(`outlier z=${fmtNum(outlier.robust_z, 1)}`);
    if (typeof outlier.ratio_to_median === "number") chips.push(`ratio=${fmtNum(outlier.ratio_to_median, 2)}`);
    if (outlier.is_outlier) chips.push("strong outlier");
    else if (outlier.is_unusual) chips.push("unusual amount");
  } else {
    chips.push("outlier: n/a");
  }

  if (sla?.available) {
    chips.push(`age ${fmtMins(sla.age_minutes)}`);
    if (sla.sla_breached) chips.push("SLA breached");
  }

  return chips;
}

export default function SignalViz({
  signals,
  sla,
}: {
  signals: { velocity: Velocity; outlier: Outlier };
  sla?: SLA;
}) {
  const v = signals.velocity || {};
  const o = signals.outlier || ({ available: false } as Outlier);

  const score = outlierScore(o); // 0..10
  const meterPct = `${(score / 10) * 100}%`;

  const chips = signalChips(v, o, sla);

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b>Signals</b>
        <span className="pill">evidence</span>
      </div>

      <div className="row" style={{ marginTop: 12, gap: 8 }}>
        {chips.map((c) => (
          <span
            key={c}
            className={`pill ${c === "SLA breached" ? "pillBreach" : ""}`}
            style={{ color: c === "SLA breached" ? undefined : "var(--muted)" }}
          >
            {c}
          </span>
        ))}
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Velocity */}
        <div className="card cardTight" style={{ boxShadow: "none" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <b>Velocity</b>
            <span className="pill">pattern</span>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {[
              { label: "10m", value: v.count_10m ?? 0, capAt: 6 },
              { label: "1h", value: v.count_1h ?? 0, capAt: 8 },
              { label: "24h", value: v.count_24h ?? 0, capAt: 20 },
            ].map((row) => (
              <div key={row.label}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="small">{row.label}</span>
                  <span className="pill">x{row.value}</span>
                </div>
                <div
                  style={{
                    marginTop: 6,
                    height: 10,
                    borderRadius: 999,
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,.02)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: barWidth(row.value, row.capAt),
                      height: "100%",
                      borderRadius: 999,
                      background: "rgba(111,160,255,.85)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Outlier */}
        <div className="card cardTight" style={{ boxShadow: "none" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <b>Outlier</b>
            <span className="pill">amount</span>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="small">Median</span>
              <span className="pill">
                {"available" in o && o.available ? fmtNum(o.median, 2) : "—"}
              </span>
            </div>

            <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
              <span className="small">
                {"available" in o && o.available && typeof o.robust_z === "number"
                  ? "Robust z"
                  : "Ratio"}
              </span>
              <span className="pill">
                {"available" in o && o.available
                  ? typeof o.robust_z === "number"
                    ? fmtNum(o.robust_z, 1)
                    : fmtNum(o.ratio_to_median, 2)
                  : "—"}
              </span>
            </div>

            <div style={{ marginTop: 10 }}>
              <div className="small">Outlier intensity</div>
              <div
                style={{
                  marginTop: 6,
                  height: 12,
                  borderRadius: 999,
                  border: "1px solid var(--border)",
                  background: "rgba(255,255,255,.02)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: meterPct,
                    height: "100%",
                    borderRadius: 999,
                    background:
                      "available" in o && o.available && o.is_outlier
                        ? "rgba(225,42,45,.75)"
                        : "rgba(149,57,242,.70)",
                  }}
                />
              </div>

              <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
                <span className="small">
                  {"available" in o && o.available ? (o.is_outlier ? "Strong outlier" : o.is_unusual ? "Unusual" : "Normal") : "n/a"}
                </span>
                <span className="pill">
                  score {fmtNum(score, 1)}/10
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SLA */}
      {sla?.available && (
        <div className="card cardTight" style={{ marginTop: 12, boxShadow: "none" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <b>SLA</b>
            {sla.sla_breached ? <span className="pill pillBreach">breached</span> : <span className="pill">ok</span>}
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <div className="small">Age</div>
              <div style={{ fontWeight: 750, marginTop: 4 }}>{fmtMins(sla.age_minutes)}</div>
            </div>
            <div>
              <div className="small">Ack target</div>
              <div style={{ fontWeight: 750, marginTop: 4 }}>{fmtMins(sla.ack_target_minutes)}</div>
            </div>
            <div>
              <div className="small">Resolve target</div>
              <div style={{ fontWeight: 750, marginTop: 4 }}>{fmtMins(sla.resolve_target_minutes)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}