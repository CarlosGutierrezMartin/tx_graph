"use client";

import { use, useEffect, useState } from "react";
import { apiGet, apiPatchJson, apiPostJson } from "@/lib/api";
import Section from "@/components/Section";
import SeverityPill from "@/components/SeverityPill";

type CaseDetail = { case: any; notes: any[]; assignments: any[] };

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const caseId = Number(id);

    const [data, setData] = useState<CaseDetail | null>(null);
    const [note, setNote] = useState("");
    const [assignee, setAssignee] = useState("");
    const [status, setStatus] = useState("");
    const [severity, setSeverity] = useState("");
    const [err, setErr] = useState("");

    async function load() {
        setErr("");
        try {
            const d = await apiGet<CaseDetail>(`/cases/${caseId}`);
            setData(d);
            setStatus(d.case.status);
            setSeverity(d.case.severity);
        } catch (e: any) {
            setErr(e.message);
        }
    }

    async function addNote() {
        if (!note.trim()) return;
        await apiPostJson(`/cases/${caseId}/notes`, { author: "analyst_1", note });
        setNote("");
        await load();
    }

    async function updateCase() {
        await apiPatchJson(`/cases/${caseId}`, {
            status: status || undefined,
            severity: severity || undefined,
            assignee: assignee || undefined,
        });
        setAssignee("");
        await load();
    }

    useEffect(() => { load(); }, [caseId]);

    if (err) return <Section title="Error"><pre>{err}</pre></Section>;
    if (!data) return <Section title="Case">Loading…</Section>;

    return (
        <div className="grid">
            <div>
                <Section title={`Case #${caseId}`} right={<button className="btn" onClick={load}>Refresh</button>}>
                    <div className="row">
                        <SeverityPill severity={data.case.severity} />
                        <span className="pill">{data.case.status}</span>
                        <span className="pill">event: {data.case.canonical_event_id ?? "n/a"}</span>
                        <span className="pill">{data.case.entity_kind}:{data.case.entity_key}</span>
                    </div>

                    <div style={{ marginTop: 10, fontWeight: 780 }}>{data.case.title}</div>
                    {data.case.description && <div className="small" style={{ marginTop: 8 }}>{data.case.description}</div>}

                    <hr />

                    <b>Update</b>
                    <div className="row" style={{ marginTop: 10 }}>
                        <select value={status} onChange={(e) => setStatus(e.target.value)}>
                            <option value="open">open</option>
                            <option value="in_progress">in_progress</option>
                            <option value="closed">closed</option>
                        </select>

                        <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                            <option value="low">low</option>
                            <option value="medium">medium</option>
                            <option value="high">high</option>
                            <option value="critical">critical</option>
                        </select>

                        <input
                            className="input"
                            style={{ maxWidth: 220 }}
                            placeholder="assignee"
                            value={assignee}
                            onChange={(e) => setAssignee(e.target.value)}
                        />

                        <button className="btn btnPrimary" onClick={updateCase}>Save</button>
                    </div>
                </Section>

                <div style={{ marginTop: 16 }}>
                    <Section title="Notes">
                        <div className="row">
                            <input
                                className="input"
                                placeholder="Add a note…"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                            />
                            <button className="btn" onClick={addNote}>Add</button>
                        </div>

                        <div style={{ marginTop: 12 }}>
                            {(data.notes || []).map((n) => (
                                <div key={n.id} className="card cardTight" style={{ marginBottom: 10 }}>
                                    <div className="row" style={{ justifyContent: "space-between" }}>
                                        <span className="pill">{n.author}</span>
                                        <span className="small">{n.created_at}</span>
                                    </div>
                                    <pre style={{ marginTop: 10 }}>{n.note}</pre>
                                </div>
                            ))}
                            {data.notes?.length === 0 && <p className="small">No notes yet.</p>}
                        </div>
                    </Section>
                </div>
            </div>

            <Section title="Evidence pack (meta)">
                <pre>{JSON.stringify(data.case.meta, null, 2)}</pre>
            </Section>
        </div>
    );
}