from __future__ import annotations

from typing import Any, Dict, List, Tuple
from neo4j import GraphDatabase
from app.core.config import settings

# Limit what can be queried to avoid Cypher injection
ALLOWED_KINDS = {
    "counterparty": {"label": "Counterparty", "key_prop": "name"},
    "account": {"label": "Account", "key_prop": "account_id"},
    "transaction": {"label": "Transaction", "key_prop": "canonical_event_id"},
}

def get_driver():
    return GraphDatabase.driver(
        settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password)
    )


def search_entities(q: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    MVP: search Counterparty by name and Account by account_id substring.
    """
    q = (q or "").strip()
    if not q:
        return []

    cypher = """
    MATCH (c:Counterparty)
    WHERE toLower(c.name) CONTAINS toLower($q)
    RETURN 'counterparty' AS kind, c.name AS key, labels(c) AS labels, properties(c) AS props
    LIMIT $limit
    UNION ALL
    MATCH (a:Account)
    WHERE toLower(a.account_id) CONTAINS toLower($q)
    RETURN 'account' AS kind, a.account_id AS key, labels(a) AS labels, properties(a) AS props
    LIMIT $limit
    """

    with get_driver() as driver:
        with driver.session() as session:
            rows = session.run(cypher, q=q, limit=limit).data()

    return [
        {
            "kind": r["kind"],
            "key": r["key"],
            "labels": r["labels"],
            "properties": r["props"],
        }
        for r in rows
    ]


def neighborhood(kind: str, key: str, hops: int = 2, limit: int = 200) -> Dict[str, Any]:
    """
    Return nodes + edges around a starting node up to k hops.
    """
    kind = (kind or "").strip().lower()
    if kind not in ALLOWED_KINDS:
        raise ValueError(f"Invalid kind. Allowed: {list(ALLOWED_KINDS.keys())}")

    hops = max(1, min(int(hops), 4))  # keep safe for MVP
    key = (key or "").strip()

    label = ALLOWED_KINDS[kind]["label"]
    key_prop = ALLOWED_KINDS[kind]["key_prop"]

    cypher = f"""
    MATCH (start:{label} {{{key_prop}: $key}})
    MATCH p=(start)-[r*1..{hops}]-(n)
    WITH collect(nodes(p)) AS node_lists, collect(relationships(p)) AS rel_lists
    UNWIND node_lists AS nl
    UNWIND nl AS node
    WITH collect(DISTINCT node) AS nodes, rel_lists
    UNWIND rel_lists AS rl
    UNWIND rl AS rel
    WITH nodes, collect(DISTINCT rel) AS rels
    RETURN nodes[0..$limit] AS nodes, rels[0..$limit] AS rels
    """

    with get_driver() as driver:
        with driver.session() as session:
            rec = session.run(cypher, key=key, limit=limit).single()

    if not rec:
        return {"nodes": [], "edges": []}

    nodes = rec["nodes"]
    rels = rec["rels"]

    out_nodes = []
    for n in nodes:
        out_nodes.append(
            {
                "id": n.id,
                "labels": list(n.labels),
                "properties": dict(n.items()),
            }
        )

    out_edges = []
    for r in rels:
        out_edges.append(
            {
                "id": r.id,
                "type": r.type,
                "start": r.start_node.id,
                "end": r.end_node.id,
                "properties": dict(r.items()),
            }
        )

    return {"nodes": out_nodes, "edges": out_edges}