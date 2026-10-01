"""Load BANKING77 and refuse to carry on if it isn't the data the contract describes."""

import json
from pathlib import Path

import pandas as pd

DATA = Path(__file__).resolve().parent.parent / "data"

EXPECTED_ROWS = {"train": 10_003, "test": 3_080}


def intents() -> list[str]:
    """The 77 intent labels, in the dataset's own order."""
    return json.loads((DATA / "categories.json").read_text())


def load(split: str) -> pd.DataFrame:
    """One split as a DataFrame with `text` and `intent` columns."""
    df = pd.read_csv(DATA / f"{split}.csv").rename(columns={"category": "intent"})

    if len(df) != EXPECTED_ROWS[split]:
        raise ValueError(f"{split}.csv has {len(df)} rows, expected {EXPECTED_ROWS[split]}")
    unknown = set(df["intent"]) - set(intents())
    if unknown:
        raise ValueError(f"{split}.csv has intents outside categories.json: {sorted(unknown)}")
    if split == "test" and set(df["intent"].value_counts()) != {40}:
        raise ValueError("test.csv should have exactly 40 messages per intent")

    return df[["text", "intent"]]
