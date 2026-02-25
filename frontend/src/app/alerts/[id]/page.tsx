"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import Section from "@/components/Section";
import SeverityPill from "@/components/SeverityPill";
import GraphView, { GraphPayload } from "@/components/GraphView";

type AlertItem = {
    id: number;
    severity: string;
    status: string;
    title: string;
    description?: string | null;
    entity_kind: string;
    entity_key: string;
    canonical_event_id?: number | null;
    case_id?: number | null;
};

type Timeline = {
    canonical_event_id: number;
    suggested_severity: string;
    signals: any;
    recommended_actions: string[];
    narrative: string[];
    graph_context: GraphPayload;
};

export default function AlertDetail({ params }: { params: { id: string } }) {
    const alertId = Number(params.id);

    const [alertData, setAlertData] = useState<AlertItem | null>(null);
    const [timeline, setTimeline] = useState<Timeline | null>(null);
    const [err, setErr] = useState("");

    async function load() {
        setErr("");
        try {
            const a = await apiGet<{ alert: AlertItem }>(`/alerts/${alertId}`);
            setAlertData(a.alert);

            if (a.alert?.canonical_event_id) {
                const t = await apiGet<Timeline>(
                    `/investigations/transactions/${a.alert.canonical_event_id}/timeline?days=30`
                );
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
        await load();
    }
    async function resolve() {
        await apiPost(`/alerts/${alertId}/resolve?actor=analyst_1`);
        await load();
    }
    async function createCase() {
        const res = await apiPost<any>(`/alerts/${alertId}/create-case?actor=analyst_1`);
        window.alert(`create-case result:\n${JSON.stringify(res, null, 2)}`);
        await load();
    }

    useEffect(() => { load(); }, [alertId]);

    return (
        <div className="grid">
            <div>
                <Section
                    title={`Alert #${alertId}`}
                    right={<button className="btn" onClick={load}>Refresh</button>}
                >
                    {err && <p className="small" style={{ color: "salmon" }}>{err}</p>}
                    {!alertData && !err && <p className="small">Loading…</p>}

                    {alertData && (
                        <>
                            <div className="row">
                                <SeverityPill severity={alertData.severity} />
                                <span className={`pill ${alertData.status === "open" ? "pillOpen" :
                                    alertData.status === "acked" ? "pillAcked" : "pillResolved"
                                    }`}>{alertData.status}</span>
                                <span className="pill">event: {alertData.canonical_event_id ?? "n/a"}</span>
                                <span className="pill">case: {alertData.case_id ?? "none"}</span>
                                {alertData.case_id && <a className="pill" href={`/cases/${alertData.case_id}`}>open case</a>}
                            </div>

                            <div style={{ marginTop: 10, fontWeight: 750 }}>{alertData.title}</div>
                            {alertData.description && <div className="small" style={{ marginTop: 8 }}>{alertData.description}</div>}

                            <div className="row" style={{ marginTop: 12 }}>
                                <button className="btn" onClick={ack}>Ack</button>
                                <button className="btn" onClick={resolve}>Resolve</button>
                                <button className="btn btnPrimary" onClick={createCase}>Create case</button>
                            </div>
                        </>
                    )}
                </Section>

                <div style={{ marginTop: 16 }}>
                    <Section title="Investigation">
                        {!timeline && <p className="small">No canonical_event_id on this alert.</p>}
                        {timeline && (
                            <>
                                <div className="row">
                                    <span className="pill">suggested: {timeline.suggested_severity}</span>
                                    <span className="pill">graph: {timeline.graph_context?.nodes?.length ?? 0} nodes</span>
                                </div>

                                <hr />

                                <div className="row" style={{ justifyContent: "space-between" }}>
                                    <b>Recommended actions</b>
                                </div>
                                <ul className="small" style={{ marginTop: 10 }}>
                                    {timeline.recommended_actions?.map((a, i) => <li key={i}>{a}</li>)}
                                </ul>

                                <hr />

                                <b>Signals</b>
                                <pre style={{ marginTop: 10 }}>{JSON.stringify(timeline.signals, null, 2)}</pre>

                                <hr />

                                <b>Narrative</b>
                                <ul className="small" style={{ marginTop: 10 }}>
                                    {timeline.narrative?.map((n, i) => <li key={i}>{n}</li>)}
                                </ul>
                            </>
                        )}
                    </Section>
                </div>
            </div>

            <div>
                {timeline ? <GraphView graph={timeline.graph_context} /> : <Section title="Graph">Graph unavailable.</Section>}
            </div>
        </div>
    );
}