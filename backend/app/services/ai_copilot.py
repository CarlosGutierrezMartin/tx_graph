from __future__ import annotations

import json
import os
import socket
import urllib.request
from typing import Any, Dict, List, Optional


def _env_bool(name: str, default: bool = False) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "on"}


AI_ENABLED = _env_bool("AI_ENABLED", default=False)
AI_PROVIDER = os.getenv("AI_PROVIDER", "ollama").strip().lower()  # "ollama" or "groq"
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434").rstrip("/")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "qwen2.5:0.5b")

# Groq uses OpenAI-compatible API
GROQ_BASE_URL = "https://api.groq.com/openai/v1"


class AICopilotError(RuntimeError):
    pass


def _post_json(url: str, payload: Dict[str, Any], timeout_s: int = 120, headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, headers=h, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        raise AICopilotError(f"HTTP {e.code}: {body}") from e
    except (urllib.error.URLError, socket.timeout) as e:
        raise AICopilotError(f"Could not reach AI service at {url}: {e}") from e


def _extract_json_object(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    snippet = text[start : end + 1]
    try:
        return json.loads(snippet)
    except Exception:
        return None


def _sanitize_actions(actions: Any) -> List[str]:
    if not isinstance(actions, list):
        return []
    out: List[str] = []
    for a in actions:
        if not isinstance(a, str):
            continue
        s = " ".join(a.strip().split())
        if not s:
            continue
        if len(s) > 160:
            s = s[:157] + "..."
        out.append(s)
    return out[:6]


SYSTEM_PROMPT = (
    "You are an investigations copilot for a fintech operations team.\n"
    "Draft analyst-friendly suggested actions and a concise summary.\n"
    "Rules:\n"
    "- Output ONLY valid JSON (no markdown, no code fences).\n"
    "- Do NOT claim fraud. Use cautious language.\n"
    "- Actions must be concrete and tied to provided signals.\n"
    "- 3 to 6 actions max.\n"
    "Output schema:\n"
    "{\n"
    '  "summary": "1-3 sentences",\n'
    '  "actions": ["..."],\n'
    '  "case_note": "short note an analyst would paste",\n'
    '  "rationale": ["bullet reasons referencing signals"],\n'
    '  "confidence": "low|medium|high"\n'
    "}\n"
)


def _call_ollama(evidence: Dict[str, Any], model: str, timeout_s: int) -> str:
    """Call local Ollama /api/chat endpoint."""
    payload = {
        "model": model,
        "stream": False,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "Evidence pack:\n" + json.dumps(evidence, ensure_ascii=False)},
        ],
    }
    resp = _post_json(f"{OLLAMA_BASE_URL}/api/chat", payload, timeout_s=timeout_s)
    return (resp.get("message", {}) or {}).get("content", "")


def _call_groq(evidence: Dict[str, Any], model: str, timeout_s: int) -> str:
    """Call Groq's OpenAI-compatible chat completions API (free tier)."""
    if not GROQ_API_KEY:
        raise AICopilotError("GROQ_API_KEY not set — get a free key at console.groq.com")

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "Evidence pack:\n" + json.dumps(evidence, ensure_ascii=False)},
        ],
        "temperature": 0.3,
        "max_tokens": 512,
    }
    resp = _post_json(
        f"{GROQ_BASE_URL}/chat/completions",
        payload,
        timeout_s=timeout_s,
        headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
    )
    choices = resp.get("choices", [])
    if not choices:
        raise AICopilotError("Groq returned empty choices")
    return (choices[0].get("message", {}) or {}).get("content", "")


def ollama_chat_json(evidence: Dict[str, Any], model: Optional[str] = None, timeout_s: int = 120) -> Dict[str, Any]:
    """
    Calls either Ollama or Groq (based on AI_PROVIDER) and returns parsed JSON output.
    """
    if not AI_ENABLED:
        raise AICopilotError("AI is disabled (set AI_ENABLED=true)")

    model_name = model or AI_MODEL

    # Route to the right provider
    if AI_PROVIDER == "groq":
        content = _call_groq(evidence, model_name, timeout_s)
    else:
        content = _call_ollama(evidence, model_name, timeout_s)

    parsed = _extract_json_object(content)
    if parsed is None:
        raise AICopilotError("Model did not return valid JSON")

    parsed["actions"] = _sanitize_actions(parsed.get("actions"))
    if not isinstance(parsed.get("summary"), str):
        parsed["summary"] = ""
    if not isinstance(parsed.get("case_note"), str):
        parsed["case_note"] = ""
    if not isinstance(parsed.get("rationale"), list):
        parsed["rationale"] = []

    conf = (parsed.get("confidence") or "").strip().lower()
    if conf not in {"low", "medium", "high"}:
        parsed["confidence"] = "medium"

    parsed["model"] = model_name
    return parsed