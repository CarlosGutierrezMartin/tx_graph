from dataclasses import dataclass
from neo4j import GraphDatabase
from app.core.config import settings


@dataclass(frozen=True)
class GraphConn:
    uri: str
    user: str
    password: str


def get_driver():
    conn = GraphConn(
        uri=settings.neo4j_uri,
        user=settings.neo4j_user,
        password=settings.neo4j_password,
    )
    return GraphDatabase.driver(conn.uri, auth=(conn.user, conn.password))


UPSERT_QUERY = """
MERGE (a:Account {account_id: $account_id})
ON CREATE SET a.created_at = timestamp()

MERGE (c:Counterparty {name: $counterparty_name})
ON CREATE SET c.created_at = timestamp()

MERGE (t:Transaction {canonical_event_id: $canonical_event_id})
ON CREATE SET t.created_at = timestamp()
SET
  t.event_type = $event_type,
  t.occurred_at = $occurred_at,
  t.amount = $amount,
  t.currency = $currency

MERGE (a)-[r1:SENT_PAYMENT]->(t)
MERGE (t)-[r2:PAID_TO]->(c)

RETURN a, t, c
"""


def upsert_transaction(canonical_event_id: int, canonical: dict) -> None:
    with get_driver() as driver:
        with driver.session() as session:
            session.run(
                UPSERT_QUERY,
                account_id=canonical["account_id"],
                counterparty_name=canonical["counterparty"]["name"],
                canonical_event_id=canonical_event_id,
                event_type=canonical["event_type"],
                occurred_at=canonical["occurred_at"],
                amount=canonical["amount"],
                currency=canonical["currency"],
            )