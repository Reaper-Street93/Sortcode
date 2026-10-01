"""Approach E: the cheap model where it's sure, Gemini where it isn't.

The confidence bar is set on the training set alone: out-of-fold predictions
from 5-fold cross-validation show how often TF-IDF is right at each confidence
level, and the bar is the lowest one where it was right at least TARGET of the
time. TARGET was fixed before any test result existed. Test predictions are
then just stitched together from the saved TF-IDF and Gemini few-shot runs, so
the hybrid costs no extra API calls to evaluate.
"""

import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold, cross_val_predict

from .tfidf import SEED, build

TARGET = 0.98


def choose_threshold(train: pd.DataFrame, C: float) -> tuple[float, dict]:
    folds = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    model = build(C)
    proba = cross_val_predict(model, train["text"], train["intent"], cv=folds,
                              method="predict_proba", n_jobs=-1)
    classes = np.unique(train["intent"])  # cross_val_predict orders columns by sorted class
    confidence = proba.max(axis=1)
    right = classes[proba.argmax(axis=1)] == train["intent"].to_numpy()

    # Walk down from the most confident prediction; keep the lowest bar that
    # still has the running accuracy at or above TARGET.
    order = np.argsort(-confidence)
    running = np.cumsum(right[order]) / np.arange(1, len(order) + 1)
    ok = np.nonzero(running >= TARGET)[0]
    threshold = float(confidence[order][ok.max()]) if len(ok) else 1.0

    covered = confidence >= threshold
    return round(threshold, 4), {
        "target_accuracy": TARGET,
        "train_share_handled_by_tfidf": round(float(covered.mean()), 4),
        "train_accuracy_when_handled": round(float(right[covered].mean()), 4),
    }


def combine(tfidf: pd.DataFrame, gemini: pd.DataFrame, threshold: float) -> tuple[list[str], np.ndarray]:
    """Per test message: TF-IDF's intent if it cleared the bar, otherwise Gemini's."""
    sure = tfidf["confidence"].to_numpy() >= threshold
    intents = np.where(sure, tfidf["pred_intent"], gemini["pred_intent"])
    return list(intents), sure
