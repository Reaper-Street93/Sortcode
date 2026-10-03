"""Run an approach on the test set, or print the comparison table.

    python -m sortcode rules
    python -m sortcode tfidf
    python -m sortcode zero     # Gemini zero-shot, needs GEMINI_API_KEY in .env
    python -m sortcode few      # Gemini few-shot
    python -m sortcode hybrid   # TF-IDF where sure, few-shot where not (needs tfidf + few first)
    python -m sortcode drip     # one patient step of zero -> few -> hybrid, for running on a schedule
    python -m sortcode demo     # export the model and results the demo page in docs/ runs on
    python -m sortcode table
"""

import json
import sys
import time

from .data import load
from .evaluate import RESULTS, attach_costs, save, score


def run_rules():
    from .models.rules import RULES, route

    test = load("test")
    start = time.perf_counter()
    queues = [route(t) for t in test["text"]]
    seconds = (time.perf_counter() - start) / len(test)

    df = attach_costs(test, queues)
    meta = {"approach": "Keyword rules", "predicts": "queue",
            "patterns": sum(len(p) for _, p in RULES), "seconds_per_ticket": seconds,
            "cost_per_10k_tickets_usd": 0.0}
    save("rules", df, score(df), meta)


def run_tfidf():
    from .models.tfidf import choose_C, fit_predict

    train, test = load("train"), load("test")
    C, cv_scores = choose_C(train)
    intents, confidence, seconds = fit_predict(train, test, C)

    df = attach_costs(test, None, intents)
    df["confidence"] = confidence
    meta = {"approach": "TF-IDF + logistic regression", "predicts": "intent",
            "C": C, "cv_macro_f1_by_C": cv_scores,
            "seconds_per_ticket": seconds,
            "cost_per_10k_tickets_usd": 0.0}
    save("tfidf", df, score(df), meta)


def run_gemini(name: str, few_shot: bool):
    from .models import gemini

    train, test = load("train"), load("test")
    examples = gemini.few_shot_examples(train) if few_shot else None
    intents, records = gemini.run(name, test, examples)

    df = attach_costs(test, None, intents)
    meta = {"approach": f"Gemini, {'few' if few_shot else 'zero'}-shot", "predicts": "intent",
            "examples_in_prompt": len(examples or []),
            **gemini.usage_summary(records, len(test))}
    save(name, df, score(df), meta)


def run_hybrid():
    import pandas as pd

    from .models.hybrid import choose_threshold, combine

    summary = json.loads((RESULTS / "summary.json").read_text())
    tfidf_meta, few_meta = summary["approaches"]["tfidf"], summary["approaches"]["gemini_few"]
    threshold, fit = choose_threshold(load("train"), tfidf_meta["C"])

    tfidf = pd.read_csv(RESULTS / "predictions" / "tfidf.csv")
    few = pd.read_csv(RESULTS / "predictions" / "gemini_few.csv")
    intents, sure = combine(tfidf, few, threshold)

    test = load("test")
    df = attach_costs(test, None, intents)
    df["answered_by"] = ["tfidf" if s else "gemini" for s in sure]
    escalated = 1 - sure.mean()
    meta = {"approach": "Hybrid: TF-IDF where sure, Gemini few-shot otherwise", "predicts": "intent",
            "confidence_threshold": threshold, **fit,
            "test_share_escalated_to_gemini": round(float(escalated), 4),
            # Only escalated tickets reach Gemini, so they carry its per-ticket cost.
            "cost_per_10k_tickets_usd": round(escalated * few_meta["cost_per_10k_tickets_usd"], 2),
            "seconds_per_ticket": round(float(sure.mean() * tfidf_meta["seconds_per_ticket"]
                                              + escalated * few_meta["seconds_per_ticket"]), 4)}
    save("hybrid", df, score(df), meta)


def drip():
    """Push the Gemini runs forward one try at a time, and say where things stand.

    For a free tier that turns most requests away: each run tries once, keeps
    going while requests succeed, and stops quietly at the first refusal.
    """
    from google.genai import errors

    from .models import gemini

    gemini.ATTEMPTS = 1
    n = len(load("test"))
    for name, few_shot in (("gemini_zero", False), ("gemini_few", True)):
        done, needed = gemini.progress(name, n)
        if done < needed:
            try:
                run_gemini(name, few_shot)
            except (errors.APIError, RuntimeError) as err:
                done, needed = gemini.progress(name, n)
                code = getattr(err, "code", None)
                reason = ("daily quota used up" if isinstance(err, gemini.QuotaExhausted)
                          else f"Gemini {code or 'error'}: {str(err)[:80]}")
                print(f"drip: {name} {done}/{needed} batches, stopped ({reason})")
                return
            print(f"drip: {name} complete")
    run_hybrid()
    print("drip: all done")


def table():
    summary = json.loads((RESULTS / "summary.json").read_text())
    rows = [
        ("Intent accuracy", "intent_accuracy", "{:.1%}"),
        ("Macro-F1", "macro_f1", "{:.3f}"),
        ("Queue accuracy", "queue_accuracy", "{:.1%}"),
        ("Security recall", "security_recall", "{:.1%}"),
        ("Security tickets missed (of 240)", "security_missed", "{}"),
        ("Harm per 1,000 tickets", "harm_per_1000", "{:.0f}"),
        ("Sent to self-serve", "automation_rate", "{:.1%}"),
        ("…of which really self-serve", "automation_precision", "{:.1%}"),
    ]
    names = list(summary["approaches"])
    print(f"{'':34}" + "".join(f"{n:>14}" for n in names))
    for label, key, fmt in rows:
        cells = []
        for n in names:
            v = summary["approaches"][n]["metrics"][key]
            cells.append(f"{'—' if v is None else fmt.format(v):>14}")
        print(f"{label:34}" + "".join(cells))


COMMANDS = {
    "rules": run_rules,
    "tfidf": run_tfidf,
    "zero": lambda: run_gemini("gemini_zero", few_shot=False),
    "few": lambda: run_gemini("gemini_few", few_shot=True),
    "hybrid": run_hybrid,
    "drip": drip,
    "demo": lambda: __import__("sortcode.export_demo", fromlist=["main"]).main(),
    "table": table,
}

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in COMMANDS:
        sys.exit(__doc__)
    COMMANDS[sys.argv[1]]()
