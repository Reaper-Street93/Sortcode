"""Approaches C and D: Gemini, zero-shot and few-shot.

Messages go in shuffled batches of 385, eight requests for the whole test set.
That size is set by the free tier, not by choice: gemini-3.6-flash allows 20
requests a day, so one-message-per-request (3,080 calls) or even batches of 40
(77 calls) would take days. The answer is held to a JSON schema whose only
allowed intents are the 77 real ones. Every raw response is cached in results/raw/, so a rerun never
spends quota twice and every number can be re-scored without a key.
"""

import json
import random
import time
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from google import genai
from google.genai import errors, types

from ..data import intents

MODEL = "gemini-3.6-flash"
THINKING = "low"
PROMPT_VERSION = 1
BATCH = 385
EXAMPLES_PER_INTENT = 3
SEED = 0

# Standard paid tier, USD per million tokens, from
# https://ai.google.dev/gemini-api/docs/pricing (valid to 31 Dec 2026; doubles after).
PRICE_PER_MILLION = {"input": 0.75, "output": 3.75}

RAW = Path(__file__).resolve().parents[2] / "results" / "raw"

# How many times one request is tried before giving up. `python -m sortcode drip`
# sets it to 1, so a busy server costs a single request and the next scheduled
# run tries again.
ATTEMPTS = 4


class QuotaExhausted(RuntimeError):
    pass


def _schema() -> dict:
    # No minItems/maxItems: pinning the length at 40 with a 77-value enum makes the
    # schema too complex and the API rejects it (400). run() checks every message
    # got an answer instead, and asks again if one didn't.
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "intent": {"type": "string", "enum": intents()},
            },
            "required": ["id", "intent"],
        },
    }


def few_shot_examples(train: pd.DataFrame) -> list[tuple[str, str]]:
    """A fixed random handful of training messages per intent. Not hand-picked."""
    picked = train.groupby("intent", group_keys=False).sample(EXAMPLES_PER_INTENT, random_state=SEED)
    rows = list(zip(picked["text"], picked["intent"]))
    random.Random(SEED).shuffle(rows)
    return rows


def prompt(messages: list[str], examples: list[tuple[str, str]] | None) -> str:
    lines = [
        "You triage customer messages for the support team of a card and e-money app.",
        "Give every message exactly one intent from this list, using its id:",
        "",
        ", ".join(intents()),
    ]
    if examples:
        lines += ["", "Examples of messages and their intents:"]
        lines += [f"- {text!r} -> {intent}" for text, intent in examples]
    lines += ["", "Messages:"]
    lines += [f"{i}. {m}" for i, m in enumerate(messages)]
    return "\n".join(lines)


def _call(client, text: str):
    """One request, with patience for busy servers and a hard stop on the daily quota."""
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_json_schema=_schema(),
        thinking_config=types.ThinkingConfig(thinking_level=THINKING),
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        max_output_tokens=32_768,  # ~20 tokens an answer; a batch of 385 must never be cut off
    )
    # Few attempts, spaced well apart: free-tier "high demand" spells last minutes,
    # and failed requests can still count against the daily quota.
    for attempt in range(ATTEMPTS):
        try:
            start = time.perf_counter()
            response = client.models.generate_content(model=MODEL, contents=text, config=config)
            return response, time.perf_counter() - start
        except errors.APIError as err:
            if err.code == 429 and "PerDay" in str(err):
                raise QuotaExhausted(f"daily free-tier quota for {MODEL} is used up") from err
            if err.code in (429, 500, 503) and attempt < ATTEMPTS - 1:
                wait = 60 * 2**attempt if err.code != 429 else 60
                print(f"  {err.code}, waiting {wait}s")
                time.sleep(wait)
                continue
            raise
    raise RuntimeError(f"{MODEL} still unavailable after {ATTEMPTS} attempts")


def _ask(client, messages: list[str], examples) -> tuple[dict, dict]:
    """Classify a list of messages; returns {index: intent} and what it cost.

    Anything the model skipped, or answered with an id that doesn't exist, is
    asked again on its own, rather than re-sending the whole batch.
    """
    answers, spent = {}, {"seconds": 0.0, "input_tokens": 0, "output_tokens": 0, "requests": 0}
    pending = list(range(len(messages)))
    for _ in range(3):
        response, seconds = _call(client, prompt([messages[i] for i in pending], examples))
        usage = response.usage_metadata
        spent["seconds"] += seconds
        spent["input_tokens"] += usage.prompt_token_count or 0
        spent["output_tokens"] += (usage.candidates_token_count or 0) + (usage.thoughts_token_count or 0)
        spent["requests"] += 1
        try:
            reply = json.loads(response.text)
        except json.JSONDecodeError:
            reply = []
        for a in reply:
            if isinstance(a.get("id"), int) and 0 <= a["id"] < len(pending):
                answers.setdefault(pending[a["id"]], a["intent"])
        pending = [i for i in range(len(messages)) if i not in answers]
        if not pending:
            return answers, spent
        print(f"  {len(pending)} messages unanswered, asking again for just those")
    raise RuntimeError(f"{len(pending)} messages never got an answer")


def run(name: str, test: pd.DataFrame, examples: list[tuple[str, str]] | None) -> tuple[list[str], list[dict]]:
    """Classify the whole test set, resuming from the cache.

    Returns the predicted intent for each test row, in test order, and the raw
    per-request records (tokens, timing) they came from.
    """
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    client = genai.Client()

    order = list(range(len(test)))
    random.Random(SEED).shuffle(order)
    batches = [order[i:i + BATCH] for i in range(0, len(order), BATCH)]

    RAW.mkdir(parents=True, exist_ok=True)
    cache_path = RAW / f"{name}.jsonl"
    done = {}
    if cache_path.exists():
        for line in cache_path.read_text().splitlines():
            record = json.loads(line)
            done[record["batch"]] = record

    with cache_path.open("a") as cache:
        for b, rows in enumerate(batches):
            if b in done:
                continue
            messages = test["text"].iloc[rows].tolist()
            answers, spent = _ask(client, messages, examples)
            record = {
                "batch": b, "rows": rows, "intents": [answers[i] for i in range(len(rows))],
                **spent, "seconds": round(spent["seconds"], 3),
                "model": MODEL, "prompt_version": PROMPT_VERSION,
            }
            cache.write(json.dumps(record) + "\n")
            cache.flush()
            done[b] = record
            print(f"  batch {b + 1}/{len(batches)} in {spent['seconds']:.1f}s")

    predicted = [None] * len(test)
    for record in done.values():
        for row, intent in zip(record["rows"], record["intents"]):
            predicted[row] = intent
    return predicted, list(done.values())


def progress(name: str, n_tickets: int) -> tuple[int, int]:
    """(batches done, batches needed) for one approach, read from its cache."""
    path = RAW / f"{name}.jsonl"
    done = len(path.read_text().splitlines()) if path.exists() else 0
    return done, -(-n_tickets // BATCH)


def usage_summary(records: list[dict], n_tickets: int) -> dict:
    input_tokens = sum(r["input_tokens"] for r in records)
    output_tokens = sum(r["output_tokens"] for r in records)
    dollars = (input_tokens * PRICE_PER_MILLION["input"] + output_tokens * PRICE_PER_MILLION["output"]) / 1e6
    return {
        "model": MODEL, "thinking_level": THINKING, "prompt_version": PROMPT_VERSION,
        "batch_size": BATCH, "requests": sum(r["requests"] for r in records),
        "input_tokens": input_tokens, "output_tokens": output_tokens,
        "price_per_million_usd": PRICE_PER_MILLION,
        "cost_per_10k_tickets_usd": round(dollars / n_tickets * 10_000, 2),
        # A ticket waits for its whole batch, so both numbers matter.
        "seconds_per_ticket": round(sum(r["seconds"] for r in records) / n_tickets, 4),
        "seconds_per_request": round(sum(r["seconds"] for r in records) / sum(r["requests"] for r in records), 2),
    }
