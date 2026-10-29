"""Model generators. `build_generator("muse-spark")` or `"scripted:<name>:<path.json>"`."""

from __future__ import annotations

from .base import Completion, Generator, Message
from .openai_compat import KNOWN_PROFILES, ModelProfile, OpenAICompatGenerator, profile_from_env
from .scripted import ScriptedGenerator


def build_generator(spec: str, cache_dir: str | None = ".keel-cache", key: str | None = None) -> Generator:
    if spec.startswith("scripted:"):
        _, name, path = spec.split(":", 2)
        return ScriptedGenerator.from_file(name, path, key=key)
    return OpenAICompatGenerator(profile_from_env(spec), cache_dir=cache_dir)


__all__ = ["Completion", "Generator", "Message", "ModelProfile", "OpenAICompatGenerator",
           "ScriptedGenerator", "KNOWN_PROFILES", "build_generator", "profile_from_env"]
