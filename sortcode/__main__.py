"""Run an approach on the test set, or print the comparison table.

    python -m sortcode rules
    python -m sortcode tfidf
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
            "cost_per_10k_tickets_gbp": 0.0}
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
            "cost_per_10k_tickets_gbp": 0.0}
    save("tfidf", df, score(df), meta)


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


COMMANDS = {"rules": run_rules, "tfidf": run_tfidf, "table": table}

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in COMMANDS:
        sys.exit(__doc__)
    COMMANDS[sys.argv[1]]()
