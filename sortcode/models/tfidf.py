"""Approach B: TF-IDF features into a logistic regression. Cheap, fast, and runs anywhere.

Word n-grams catch phrases ("top up", "charged twice"); character n-grams catch
typos and word forms ("recieved", "withdrawl"), which real tickets are full of.
"""

import time

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.pipeline import make_pipeline, make_union

SEED = 0
C_GRID = (1, 3, 10, 30, 100)


def build(C: float):
    features = make_union(
        TfidfVectorizer(analyzer="word", ngram_range=(1, 2), sublinear_tf=True),
        TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), sublinear_tf=True),
    )
    return make_pipeline(features, LogisticRegression(C=C, max_iter=5000))


def choose_C(train: pd.DataFrame) -> tuple[float, dict]:
    """Pick C by 5-fold cross-validated macro-F1 on the training set only."""
    folds = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    scores = {
        C: float(cross_val_score(build(C), train["text"], train["intent"],
                                 cv=folds, scoring="f1_macro", n_jobs=-1).mean())
        for C in C_GRID
    }
    return max(scores, key=scores.get), scores


def fit_predict(train: pd.DataFrame, test: pd.DataFrame, C: float):
    """Train on all of train, predict test.

    Returns the intents, the model's confidence in each, and seconds per ticket
    for prediction alone (training is a one-off, not a per-ticket cost).
    """
    model = build(C).fit(train["text"], train["intent"])
    start = time.perf_counter()
    proba = model.predict_proba(test["text"])
    seconds = (time.perf_counter() - start) / len(test)
    intents = model.classes_[proba.argmax(axis=1)]
    return list(intents), np.round(proba.max(axis=1), 4), seconds
