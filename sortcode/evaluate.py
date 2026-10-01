"""Score an approach's predictions the same way for every approach, and save them."""

import json
import platform
from datetime import date
from importlib.metadata import version
from pathlib import Path

import pandas as pd
from sklearn.metrics import f1_score

from .routing import COST, QUEUE_OF, cost

RESULTS = Path(__file__).resolve().parent.parent / "results"


def _r(x, digits=4) -> float:
    """Round to a plain float, so numpy scalars don't leak into the JSON."""
    return float(round(x, digits))


def attach_costs(test: pd.DataFrame, pred_queue, pred_intent=None) -> pd.DataFrame:
    """One row per test message, with what was predicted and what it cost."""
    df = test.copy()
    df["pred_intent"] = pred_intent if pred_intent is not None else None
    df["true_queue"] = df["intent"].map(QUEUE_OF)
    df["pred_queue"] = (
        list(pred_queue) if pred_queue is not None else df["pred_intent"].map(QUEUE_OF)
    )
    df["cost"] = [
        cost(t, q, i if isinstance(i, str) else None)
        for t, q, i in zip(df["intent"], df["pred_queue"], df["pred_intent"])
    ]
    return df


def score(df: pd.DataFrame) -> dict:
    """Every metric in CONTRACT.md, from a frame made by attach_costs."""
    has_intents = df["pred_intent"].notna().all()
    security = df[df["true_queue"] == "security"]
    to_bot = df[df["pred_queue"] == "self_serve"]

    metrics = {
        "intent_accuracy": _r((df["pred_intent"] == df["intent"]).mean(), 4) if has_intents else None,
        "macro_f1": _r(f1_score(df["intent"], df["pred_intent"], average="macro"), 4) if has_intents else None,
        "queue_accuracy": _r((df["pred_queue"] == df["true_queue"]).mean(), 4),
        "security_recall": _r((security["pred_queue"] == "security").mean(), 4),
        "security_missed": int((security["pred_queue"] != "security").sum()),
        "harm_per_1000": _r(df["cost"].mean() * 1000, 1),
        "automation_rate": _r(len(to_bot) / len(df), 4),
        "automation_precision": _r((to_bot["true_queue"] == "self_serve").mean(), 4) if len(to_bot) else None,
        "queue_recall": {
            q: _r((g["pred_queue"] == q).mean(), 4) for q, g in df.groupby("true_queue")
        },
        "harm_by_source": _harm_by_source(df),
        "worst_confusions": _worst_confusions(df, has_intents),
    }
    return metrics


def _harm_by_source(df: pd.DataFrame) -> dict:
    """Where the harm comes from: share of the total cost per kind of mistake."""
    def kind(row):
        if row.cost == 0:
            return None
        if row.true_queue == "security":
            return "security_missed"
        if row.true_queue != "self_serve":
            return "human_to_bot" if row.pred_queue == "self_serve" else "human_to_wrong_human"
        if row.pred_queue == "self_serve":
            return "bot_wrong_answer"
        return "bot_to_security" if row.pred_queue == "security" else "bot_to_human"

    kinds = df.apply(kind, axis=1)
    total = df["cost"].sum()
    by = df.groupby(kinds)["cost"].sum()
    return {k: _r(v / total, 3) for k, v in by.sort_values(ascending=False).items()} if total else {}


def _worst_confusions(df: pd.DataFrame, has_intents: bool, n: int = 10) -> list[dict]:
    """The mix-ups that cost the most, each with a real example message."""
    wrong = df[df["cost"] > 0]
    keys = ["intent", "pred_intent"] if has_intents else ["true_queue", "pred_queue"]
    grouped = wrong.groupby(keys).agg(count=("cost", "size"), cost=("cost", "sum"), example=("text", "first"))
    top = grouped.sort_values(["cost", "count"], ascending=False).head(n).reset_index()
    return [
        {"true": r[keys[0]], "predicted": r[keys[1]], "count": int(r["count"]),
         "cost": float(r["cost"]), "example": r["example"]}
        for _, r in top.iterrows()
    ]


def save(name: str, df: pd.DataFrame, metrics: dict, meta: dict) -> None:
    """Write predictions/<name>.csv and merge this approach into summary.json."""
    (RESULTS / "predictions").mkdir(parents=True, exist_ok=True)
    df.to_csv(RESULTS / "predictions" / f"{name}.csv", index=False)

    summary_path = RESULTS / "summary.json"
    summary = json.loads(summary_path.read_text()) if summary_path.exists() else {"approaches": {}}
    summary["cost_matrix"] = COST
    summary["approaches"][name] = {
        "run_date": date.today().isoformat(),
        "python": platform.python_version(),
        "scikit_learn": version("scikit-learn"),
        **meta,
        "metrics": metrics,
    }
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n")
