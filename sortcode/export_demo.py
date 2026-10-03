"""Write everything the demo page needs into docs/, as static files.

The TF-IDF model is refitted exactly as benchmarked (same data, same C) and
checked against the saved benchmark predictions before anything is written,
so the page runs the model the numbers came from, not a lookalike. Weights are
stored as 16-bit integers with a scale per intent: the same top answer on every
test message, and confidence within 0.0001 of the original.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd

from .data import load
from .evaluate import RESULTS
from .models.rules import RULES
from .models.tfidf import build
from .routing import COST, QUEUE_OF

DOCS = Path(__file__).resolve().parent.parent / "docs"
APPROACHES = ["rules", "tfidf", "gemini_zero", "gemini_few", "hybrid"]


def export_model(summary: dict) -> None:
    train, test = load("train"), load("test")
    model = build(summary["approaches"]["tfidf"]["C"]).fit(train["text"], train["intent"])

    saved = pd.read_csv(RESULTS / "predictions" / "tfidf.csv")
    if not (model.predict(test["text"]) == saved["pred_intent"]).all():
        raise RuntimeError("refitted model disagrees with the benchmark predictions")

    union, lr = model.steps[0][1], model.steps[1][1]
    (_, word), (_, char) = union.transformer_list

    def vocab_list(vectorizer):
        terms = [None] * len(vectorizer.vocabulary_)
        for term, i in vectorizer.vocabulary_.items():
            terms[i] = term
        return terms

    scale = np.abs(lr.coef_).max(axis=1) / 32767
    weights = np.round(lr.coef_ / scale[:, None]).astype("<i2")

    out = DOCS / "model"
    out.mkdir(parents=True, exist_ok=True)
    (out / "weights.bin").write_bytes(weights.tobytes())
    (out / "idf.bin").write_bytes(np.concatenate([word.idf_, char.idf_]).astype("<f4").tobytes())
    meta = {
        "classes": list(lr.classes_),
        "intercept": lr.intercept_.tolist(),
        "scale": scale.tolist(),
        "word_vocab": vocab_list(word),
        "char_vocab": vocab_list(char),
        "threshold": summary["approaches"]["hybrid"]["confidence_threshold"],
        "rules": [{"queue": q, "patterns": p} for q, p in RULES],
        "queue_of": QUEUE_OF,
        "cost": COST,
    }
    (out / "meta.json").write_text(json.dumps(meta, separators=(",", ":"), ensure_ascii=False))


def export_results(summary: dict) -> None:
    test = load("test")
    preds = {a: pd.read_csv(RESULTS / "predictions" / f"{a}.csv") for a in APPROACHES}
    messages = []
    for i, row in test.iterrows():
        entry = {"text": row["text"], "intent": row["intent"], "queue": QUEUE_OF[row["intent"]], "by": {}}
        for a, df in preds.items():
            p = df.iloc[i]
            entry["by"][a] = {
                "intent": p["pred_intent"] if isinstance(p["pred_intent"], str) else None,
                "queue": p["pred_queue"],
                "cost": float(p["cost"]),
            }
        entry["by"]["tfidf"]["confidence"] = float(preds["tfidf"].iloc[i]["confidence"])
        entry["by"]["hybrid"]["answered_by"] = preds["hybrid"].iloc[i]["answered_by"]
        messages.append(entry)

    keep = ("intent_accuracy", "queue_accuracy", "security_missed", "harm_per_1000",
            "automation_rate", "automation_precision")
    approaches = {
        a: {"name": summary["approaches"][a]["approach"],
            "cost_per_10k_tickets_usd": summary["approaches"][a].get("cost_per_10k_tickets_usd", 0.0),
            **{k: summary["approaches"][a]["metrics"][k] for k in keep}}
        for a in APPROACHES
    }
    model_name = summary["approaches"]["gemini_few"]["model"]

    out = DOCS / "data"
    out.mkdir(parents=True, exist_ok=True)
    (out / "messages.json").write_text(json.dumps(messages, separators=(",", ":"), ensure_ascii=False))
    (out / "summary.json").write_text(json.dumps(
        {"approaches": approaches, "gemini_model": model_name, "cost_matrix": COST}, indent=1))


def main() -> None:
    summary = json.loads((RESULTS / "summary.json").read_text())
    export_model(summary)
    export_results(summary)
    for path in sorted(DOCS.rglob("*")):
        if path.is_file():
            print(f"  {path.relative_to(DOCS)}  {path.stat().st_size / 1e6:.2f} MB")
