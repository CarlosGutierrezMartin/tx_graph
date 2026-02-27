"use client";

import { use, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import Section from "@/components/Section";
import SeverityPill from "@/components/SeverityPill";
import GraphView, { GraphPayload } from "@/components/GraphView";
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
    sla?: any;
};

type Timeline = {
    canonical_event_id: number;
    suggested_severity: string;
    signals: any;
    recommended_actions: string[];
    narrative: string[];
    graph_context: GraphPayload;
    event?: any;
};

type AIDraft = {
    model: string;
    summary: string;
    actions: string[];
    case_note: string;
    rationale: string[];
    confidence: "low" | "medium" | "high";
};

function moneyFromAlert(alert: Alert) {
    const p = alert.payload || {};
    const amount = p.amount;
    const currency = p.currency;
    if (typeof amount === "number" && typeof currency === "string") return `${amount.toFixed(2)} ${currency}`;
    if (typeof amount === "string" && typeof currency === "string") return `${amount} ${currency}`;
    return "—";
}

function fmtIso(iso?: string | null) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

export default function AlertDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const alertId = Number(id);

    const [alert, setAlert] = useState<Alert | null>(null);
    const [timeline, setTimeline] = useState<Timeline | null>(null);
    const [err, setErr] = useState("");

    // AI Copilot
    const [aiLoading, setAiLoading] = useState(false);
    const [aiDraft, setAiDraft] = useState<AIDraft | null>(null);

    // toast
    const [toastOpen, setToastOpen] = useState(false);
    const [toastTone, setToastTone] = useState<ToastTone>("info");
    const [toastMsg, setToastMsg] = useState("");

    const showToast = (tone: ToastTone, message: string) => {
        setToastTone(tone);
        setToastMsg(message);
        setToastOpen(true);
    };

    const eventId = useMemo(() => {
        if (!alert) return null;
        return (
            alert.latest_canonical_event_id ??
            alert.canonical_event_id ??
            alert.payload?.canonical_event_id ??
            null
        );
    }, [alert]);

    async function load() {
        setErr("");
        try {
            const a = await apiGet<{ alert: Alert }>(`/alerts/${alertId}`);
            setAlert(a.alert);

            const evtId =
                a.alert.latest_canonical_event_id ??
                a.alert.canonical_event_id ??
                a.alert.payload?.canonical_event_id;

            if (evtId) {
                const t = await apiGet<Timeline>(`/investigations/transactions/${evtId}/timeline?days=30`);
                setTimeline(t);
            } else {
                setTimeline(null);
            }
        } catch (e: any) {
            setErr(e.message);
        }
    }

    async function ack() {
        await apiPost(`/alerts/${alertId}/ack?actor=analyst_1`);
        showToast("success", `Alert #${alertId} acked`);
        await load();
    }
    async function resolve() {
        await apiPost(`/alerts/${alertId}/resolve?actor=analyst_1`);
        showToast("success", `Alert #${alertId} resolved`);
        await load();
    }
    async function createCase() {
        const res = await apiPost<any>(`/alerts/${alertId}/create-case?actor=analyst_1`);
        if (res.created) {
            showToast("success", `Case #${res.case_id} created from alert #${alertId}`);
        } else {
            showToast("info", `Alert #${alertId} already linked to case #${res.case_id}`);
        }
        await load();
    }

    async function runCopilot() {
        setAiLoading(true);
        setAiDraft(null);
        try {
            const res = await apiPost<{ ok: boolean; draft: AIDraft }>(`/ai/alerts/${alertId}/draft`);
            setAiDraft(res.draft);
            showToast("success", `Copilot draft ready (${res.draft.model})`);
        } catch (e: any) {
            showToast("error", e.message);
        } finally {
            setAiLoading(false);
        }
    }

    async function copy(text: string) {
        try {
            await navigator.clipboard.writeText(text);
            showToast("success", "Copied to clipboard");
        } catch {
            showToast("error", "Could not copy");
        }
    }

    useEffect(() => {
        load();
    }, [alertId]);

    return (
        <>
            <Toast open={toastOpen} message={toastMsg} tone={toastTone} onClose={() => setToastOpen(false)} />

            <div className="grid">
                <div>
                    <Section
                        title={`Alert #${alertId}`}
                        right={<button className="btn" onClick={load}>Refresh</button>}
                    >
                        {err && <p className="small" style={{ color: "salmon" }}>{err}</p>}
                        {!alert && !err && <p className="small">Loading…</p>}

                        {alert && (
                            <>
                                <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}>
                                    <div className="row">
                                        <SeverityPill severity={alert.severity} />
                                        <span className="pill">{alert.status}</span>
                                        {alert.sla?.sla_breached && <span className="pill pillBreach">SLA breached</span>}
                                        {typeof alert.occurrences === "number" && alert.occurrences > 1 && (
                                            <span className="pill">x{alert.occurrences}</span>
                                        )}
                                    </div>

                                    <div className="row">
                                        {alert.case_id && <a className="pill" href={`/cases/${alert.case_id}`}>open case</a>}
                                    </div>
                                </div>

                                <div style={{ marginTop: 10, fontWeight: 820, letterSpacing: "-0.02em", fontSize: 18 }}>
                                    {alert.title}
                                </div>

                                {alert.description && (
                                    <div className="small" style={{ marginTop: 8 }}>
                                        {alert.description}
                                    </div>
                                )}

                                <div
                                    className="card cardTight"
                                    style={{
                                        marginTop: 14,
                                        boxShadow: "none",
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: 12,
                                    }}
                                >
                                    <div>
                                        <div className="small">Entity</div>
                                        <div style={{ fontWeight: 760, marginTop: 4 }}>
                                            {alert.entity_kind}: {alert.entity_key}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="small">Amount</div>
                                        <div style={{ fontWeight: 760, marginTop: 4 }}>{moneyFromAlert(alert)}</div>
                                    </div>

                                    <div>
                                        <div className="small">Latest event id</div>
                                        <div style={{ fontWeight: 760, marginTop: 4 }}>{eventId ?? "—"}</div>
                                    </div>
                                    <div>
                                        <div className="small">Last seen</div>
                                        <div style={{ fontWeight: 760, marginTop: 4 }}>{fmtIso(alert.last_seen_at)}</div>
                                    </div>
                                </div>

                                <div className="row" style={{ marginTop: 14 }}>
                                    {alert.status !== "resolved" && (
                                        <>
                                            <button className="btn" onClick={ack} disabled={alert.status !== "open"}>
                                                Ack
                                            </button>
                                            <button className="btn" onClick={resolve}>
                                                Resolve
                                            </button>
                                        </>
                                    )}
                                    <button className="btn btnPrimary" onClick={createCase}>
                                        Create case
                                    </button>
                                    {eventId && (
                                        <a className="btn" href={`/graph?kind=counterparty&key=${encodeURIComponent(alert.entity_key)}&hops=2`}>
                                            Open in graph explorer
                                        </a>
                                    )}
                                </div>
                            </>
                        )}
                    </Section>

                    {timeline && <SignalViz signals={timeline.signals} sla={alert?.sla} />}

                    {/* Copilot panel */}
                    <div style={{ marginTop: 16 }}>
                        <Section
                            title="Copilot"
                            right={
                                <button className={`btn ${aiLoading ? "" : "btnPrimary"}`} onClick={runCopilot} disabled={aiLoading}>
                                    {aiLoading ? "Generating…" : "Generate AI draft"}
                                </button>
                            }
                        >
                            {!aiDraft && (
                                <div className="small">
                                    Copilot drafts actions + a case note using your existing evidence pack. It won’t change severity.
                                </div>
                            )}

                            {aiDraft && (
                                <>
                                    <div className="row" style={{ justifyContent: "space-between" }}>
                                        <span className="pill">model: {aiDraft.model}</span>
                                        <span className="pill">confidence: {aiDraft.confidence}</span>
                                    </div>

                                    <div style={{ marginTop: 12 }}>
                                        <b>Summary</b>
                                        <div className="small" style={{ marginTop: 6 }}>{aiDraft.summary}</div>
                                    </div>

                                    <div style={{ marginTop: 12 }}>
                                        <div className="row" style={{ justifyContent: "space-between" }}>
                                            <b>Actions</b>
                                            <button className="btn" onClick={() => copy(aiDraft.actions.join("\n"))}>Copy</button>
                                        </div>
                                        <ul className="small" style={{ marginTop: 10 }}>
                                            {aiDraft.actions.map((a, i) => <li key={i}>{a}</li>)}
                                        </ul>
                                    </div>

                                    <div style={{ marginTop: 12 }}>
                                        <div className="row" style={{ justifyContent: "space-between" }}>
                                            <b>Case note draft</b>
                                            <button className="btn" onClick={() => copy(aiDraft.case_note)}>Copy</button>
                                        </div>
                                        <pre style={{ marginTop: 10 }}>{aiDraft.case_note}</pre>
                                    </div>

                                    <details style={{ marginTop: 12 }}>
                                        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Rationale</summary>
                                        <ul className="small" style={{ marginTop: 10 }}>
                                            {(aiDraft.rationale || []).map((r, i) => <li key={i}>{r}</li>)}
                                        </ul>
                                    </details>
                                </>
                            )}
                        </Section>
                    </div>

                    <div style={{ marginTop: 16 }}>
                        <Section title="Recommended actions">
                            {!timeline && <p className="small">No timeline available.</p>}
                            {timeline && (
                                <div style={{ display: "grid", gap: 10 }}>
                                    {(timeline.recommended_actions || []).map((a, i) => (
                                        <div
                                            key={i}
                                            className="card cardTight"
                                            style={{ boxShadow: "none", display: "flex", alignItems: "flex-start", gap: 10 }}
                                        >
                                            <div
                                                style={{
                                                    width: 10,
                                                    height: 10,
                                                    borderRadius: 4,
                                                    marginTop: 4,
                                                    background: "rgba(191,255,55,.75)",
                                                }}
                                            />
                                            <div style={{ fontWeight: 650 }}>{a}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Section>
                    </div>

                    <div style={{ marginTop: 16 }}>
                        <Section title="Details">
                            {!timeline ? (
                                <p className="small">No details available.</p>
                            ) : (
                                <>
                                    <details>
                                        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Narrative</summary>
                                        <ul className="small" style={{ marginTop: 10 }}>
                                            {timeline.narrative?.map((n, i) => <li key={i}>{n}</li>)}
                                        </ul>
                                    </details>

                                    <div style={{ marginTop: 12 }} />

                                    <details>
                                        <summary style={{ cursor: "pointer", fontWeight: 700 }}>View raw</summary>
                                        <div style={{ marginTop: 10 }}>
                                            <pre>{JSON.stringify({ alert, timeline }, null, 2)}</pre>
                                        </div>
                                    </details>
                                </>
                            )}
                        </Section>
                    </div>
                </div>

                <div>
                    {timeline ? <GraphView graph={timeline.graph_context} /> : <Section title="Graph">Graph unavailable.</Section>}
                </div>
            </div>
        </>
    );
}