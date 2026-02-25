export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/v1";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  return res.json();
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  return handle<T>(res);
}

export async function apiPost<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", cache: "no-store" });
  return handle<T>(res);
}

export async function apiPostJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return handle<T>(res);
}

export async function apiPatchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return handle<T>(res);
}