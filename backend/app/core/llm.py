import json
import re
import time

from groq import Groq

from app.core.config import settings


class LLMError(Exception):
    pass


PREFERRED = [
    "llama-3.3-70b-versatile",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "openai/gpt-oss-120b",
    "llama-3.1-8b-instant",
    "openai/gpt-oss-20b",
]
SKIP = ("whisper", "guard", "tts", "orpheus", "playai", "embed", "compound")


def parse_json(text: str):
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.I)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.S)
        if m:
            try:
                return json.loads(m.group())
            except json.JSONDecodeError:
                pass
    raise LLMError("Model did not return valid JSON.")


class GroqLLM:
    def __init__(self, api_key: str | None = None, model: str | None = None):
        key = api_key or settings.groq_api_key
        if not key:
            raise LLMError("GROQ_API_KEY is not set in backend/.env")
        self.client = Groq(api_key=key)
        self.model = model or settings.groq_model
        self.bad_models: set[str] = set()

    def _pick_model(self) -> str | None:
        ids = [m.id for m in self.client.models.list().data]
        for p in PREFERRED:
            if p in ids and p not in self.bad_models:
                return p
        for i in sorted(ids):
            if i not in self.bad_models and not any(s in i for s in SKIP):
                return i
        return None

    def generate_json(self, system: str, prompt: str, retries: int = 3):
        last: Exception | None = None
        attempt = 0
        switches = 0
        while attempt < retries:
            try:
                resp = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system + " Respond with a single JSON object only."},
                        {"role": "user", "content": prompt},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1,
                    max_tokens=4096,
                )
                return parse_json(resp.choices[0].message.content or "")
            except LLMError as exc:
                last = exc
                attempt += 1
            except Exception as exc:
                msg = f"{type(exc).__name__}: {exc}"
                last = LLMError(f"Groq request failed ({self.model}): {msg}")
                if "model_not_found" in msg or "decommissioned" in msg:
                    self.bad_models.add(self.model)
                    nxt = self._pick_model() if switches < 6 else None
                    if nxt:
                        self.model, switches = nxt, switches + 1
                        continue
                    raise last
                attempt += 1
                time.sleep(8 * attempt if "RateLimit" in type(exc).__name__ else 2 * attempt)
        raise last or LLMError("Unknown LLM failure.")


def get_llm() -> GroqLLM:
    return GroqLLM()