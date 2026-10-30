"""OpenAI-compatible chat-completions client used for every Meta model endpoint.

The Meta Model API (Muse Spark) and the inference partners serving the open-weights
models (Muse Spark Open, Muse Glimmer on Baseten / Fireworks / Modal) all expose
`/chat/completions`. Each model is a profile configured from environment variables, so
switching providers is a config change, not a code change.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import time
from dataclasses import dataclass, field
from pathlib import Path

import httpx

from .base import Completion, Message


@dataclass
class ModelProfile:
    name: str
    base_url: str
    api_key: str
    model: str
    price_in_per_m: float = 0.0
    price_out_per_m: float = 0.0
    logprobs: bool = False
    extra_body: dict = field(default_factory=dict)

    @property
    def configured(self) -> bool:
        return bool(self.base_url and self.api_key and self.model)


# name -> (env prefix, default model id, default base url)
KNOWN_PROFILES = {
    "muse-spark": ("KEEL_MUSE_SPARK", "", ""),
    "muse-spark-open": ("KEEL_SPARK_OPEN", "meta-models/muse-spark-open-1026",
                        "https://inference.baseten.co/v1"),
    "muse-glimmer": ("KEEL_GLIMMER", "", ""),
}


# $ per 1M (input, output) tokens for model IDs whose price is published, used when the
# KEEL_*_PRICE_IN / _PRICE_OUT variables are unset. Contributor variants are left out: their
# rates differ and are not confirmed here.
DEFAULT_PRICES = {
    "muse-spark-1.1": (1.25, 4.25),
    "muse-spark-1.3": (1.25, 4.25),
}


def profile_from_env(name: str) -> ModelProfile:
    if name not in KNOWN_PROFILES:
        raise KeyError(f"unknown model profile {name!r}; known: {sorted(KNOWN_PROFILES)}")
    prefix, default_model, default_url = KNOWN_PROFILES[name]
    # Unset GitHub variables arrive as empty strings, so empty means "use the default".
    def env(k: str, default: str = "") -> str:
        return os.environ.get(k) or default
    extra = env(f"{prefix}_EXTRA_BODY", "")
    model = env(f"{prefix}_MODEL", default_model)
    price_in, price_out = DEFAULT_PRICES.get(model, (0.0, 0.0))
    return ModelProfile(
        name=name,
        base_url=env(f"{prefix}_BASE_URL", default_url).rstrip("/"),
        api_key=env(f"{prefix}_API_KEY", ""),
        model=model,
        price_in_per_m=float(env(f"{prefix}_PRICE_IN") or price_in),
        price_out_per_m=float(env(f"{prefix}_PRICE_OUT") or price_out),
        logprobs=env(f"{prefix}_LOGPROBS", "1" if name != "muse-spark" else "0") == "1",
        extra_body=json.loads(extra) if extra else {},
    )


class OpenAICompatGenerator:
    def __init__(self, profile: ModelProfile, cache_dir: str | Path | None = ".keel-cache",
                 timeout: float = 180.0, max_retries: int = 4):
        self.profile = profile
        self.name = profile.name
        self.cache_dir = Path(cache_dir) if cache_dir else None
        self.timeout = timeout
        self.max_retries = max_retries

    def _body(self, messages: list[Message], temperature: float, seed: int, max_tokens: int,
              logprobs: bool) -> dict:
        body = {"model": self.profile.model, "messages": messages, "temperature": temperature,
                "max_tokens": max_tokens, "seed": seed}
        if logprobs:
            body["logprobs"] = True
        body.update(self.profile.extra_body)
        return body

    def _cache_path(self, body: dict) -> Path | None:
        if not self.cache_dir:
            return None
        key = hashlib.sha256(json.dumps([self.profile.base_url, body], sort_keys=True).encode()).hexdigest()
        return self.cache_dir / f"{self.name}-{key[:24]}.json"

    def _post(self, body: dict) -> dict:
        url = f"{self.profile.base_url}/chat/completions"
        headers = {"Authorization": f"Bearer {self.profile.api_key}", "Content-Type": "application/json"}
        delay = 2.0
        last: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                r = httpx.post(url, json=body, headers=headers, timeout=self.timeout)
                if r.status_code == 400 and body.get("logprobs"):
                    # Endpoint does not support logprobs: retry once without.
                    body = {k: v for k, v in body.items() if k != "logprobs"}
                    continue
                if r.status_code in (429, 500, 502, 503, 504):
                    raise httpx.HTTPStatusError(f"{r.status_code}", request=r.request, response=r)
                r.raise_for_status()
                return r.json()
            except (httpx.HTTPError, json.JSONDecodeError) as e:
                last = e
                if attempt < self.max_retries:
                    time.sleep(delay)
                    delay *= 2
        raise RuntimeError(f"{self.name}: request failed after retries: {last}")

    def _parse(self, data: dict, latency: float) -> Completion:
        choice = (data.get("choices") or [{}])[0]
        msg = choice.get("message") or {}
        text = msg.get("content") or ""
        usage = data.get("usage") or {}
        details = usage.get("completion_tokens_details") or {}
        reasoning = msg.get("reasoning_content") or msg.get("reasoning") or ""
        reasoning_tokens = int(details.get("reasoning_tokens") or 0) or (len(reasoning) // 4)
        lp = ((choice.get("logprobs") or {}).get("content")) or []
        vals = [t["logprob"] for t in lp if isinstance(t, dict) and isinstance(t.get("logprob"), (int, float))
                and math.isfinite(t["logprob"])]
        pt = int(usage.get("prompt_tokens") or 0)
        ct = int(usage.get("completion_tokens") or 0)
        cost = pt / 1e6 * self.profile.price_in_per_m + ct / 1e6 * self.profile.price_out_per_m
        return Completion(text=text, prompt_tokens=pt, completion_tokens=ct, reasoning_tokens=reasoning_tokens,
                          mean_logprob=(sum(vals) / len(vals)) if vals else None,
                          min_logprob=min(vals) if vals else None, cost_usd=cost, latency_s=latency)

    def complete(self, messages: list[Message], n: int = 1, temperature: float = 0.8,
                 seed: int = 0, max_tokens: int = 4096) -> list[Completion]:
        if not self.profile.configured:
            raise RuntimeError(f"model profile {self.name!r} is not configured (see NEEDS_FROM_YOU.md)")
        out: list[Completion] = []
        for i in range(n):
            body = self._body(messages, temperature, seed + i, max_tokens, self.profile.logprobs)
            cp = self._cache_path(body)
            if cp and cp.exists():
                data = json.loads(cp.read_text())
                c = self._parse(data["response"], data.get("latency", 0.0))
                c.cached = True
                out.append(c)
                continue
            t0 = time.time()
            try:
                data = self._post(body)
            except RuntimeError as e:
                out.append(Completion(text="", error=str(e)))
                continue
            latency = time.time() - t0
            if cp:
                cp.parent.mkdir(parents=True, exist_ok=True)
                cp.write_text(json.dumps({"response": data, "latency": latency}))
            out.append(self._parse(data, latency))
        return out
