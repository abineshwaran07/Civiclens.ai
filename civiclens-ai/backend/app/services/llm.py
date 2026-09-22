"""Thin wrapper around Google Gemini (chat + embeddings).

Without GEMINI_API_KEY the app runs in *offline demo mode*: retrieval uses BM25 keyword search
and answers are extracted from the top passages, so everything can be demoed and tested for free.
"""
import json
import logging
import re

import numpy as np

from ..config import get_settings

log = logging.getLogger("civiclens.llm")

_TAMIL = re.compile(r"[\u0B80-\u0BFF]")


def detect_language(text: str) -> str:
    """'ta' if the text contains Tamil script, otherwise 'en'."""
    return "ta" if _TAMIL.search(text) else "en"


class LLM:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.available = bool(self.settings.gemini_api_key)
        self._client = None
        if self.available:
            from google import genai

            self._client = genai.Client(api_key=self.settings.gemini_api_key)

    @property
    def mode(self) -> str:
        return "gemini" if self.available else "offline"

    def embed(self, texts: list[str], query: bool = False) -> list[list[float]]:
        """Return L2-normalised embeddings (Gemini's truncated 768-d vectors need normalising)."""
        if not self.available:
            raise RuntimeError("Embeddings need GEMINI_API_KEY")
        from google.genai import types

        cfg = types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY" if query else "RETRIEVAL_DOCUMENT",
            output_dimensionality=self.settings.embed_dim,
        )
        out: list[list[float]] = []
        for i in range(0, len(texts), 50):
            batch = texts[i : i + 50]
            resp = self._client.models.embed_content(  # type: ignore[union-attr]
                model=self.settings.gemini_embed_model, contents=batch, config=cfg
            )
            for e in resp.embeddings or []:
                v = np.asarray(e.values, dtype=np.float32)
                n = np.linalg.norm(v)
                out.append((v / n if n else v).tolist())
        return out

    def generate(self, prompt: str, system: str | None = None, json_mode: bool = False, temperature: float = 0.2) -> str:
        if not self.available:
            raise RuntimeError("Generation needs GEMINI_API_KEY")
        from google.genai import types

        kwargs: dict = {"temperature": temperature}
        if system:
            kwargs["system_instruction"] = system
        if json_mode:
            kwargs["response_mime_type"] = "application/json"
        if self.settings.gemini_thinking_budget >= 0:
            kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=self.settings.gemini_thinking_budget)
        resp = self._client.models.generate_content(  # type: ignore[union-attr]
            model=self.settings.gemini_chat_model,
            contents=prompt,
            config=types.GenerateContentConfig(**kwargs),
        )
        return (resp.text or "").strip()

    def generate_json(self, prompt: str, system: str | None = None) -> dict:
        text = self.generate(prompt, system=system, json_mode=True)
        text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
        return json.loads(text)


_llm: LLM | None = None


def get_llm() -> LLM:
    global _llm
    if _llm is None:
        _llm = LLM()
    return _llm
