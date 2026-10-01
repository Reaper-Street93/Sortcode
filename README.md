# Sortcode

Which customer messages to a card company can a machine safely route or answer
on its own, which must reach a person, and what does each approach cost?

A sort code sends money to the right bank. Sortcode sends each support ticket
to the right queue, then scores every approach by **what its mistakes would
cost the business**, not just by accuracy. A stolen card that gets an FAQ link
is a different order of failure from an FAQ that lands on an agent's desk.

The spec came first: [CONTRACT.md](CONTRACT.md) sets out the queues, the cost
of each kind of mistake and the metrics, all fixed before any code.

## Results so far

3,080 test messages from [BANKING77](data/README.md), 40 for each of 77
intents. Each approach was scored on the test set once, after it was frozen.

| | Keyword rules | TF-IDF + logistic regression |
|---|---:|---:|
| Intent accuracy | — | 91.5% |
| Queue accuracy | 78.4% | 96.7% |
| **Security tickets missed (of 240)** | **70** | **6** |
| **Harm per 1,000 tickets** | **1,253** | **91** |
| Sent to self-serve | 69.2% | 51.8% |
| …of which really self-serve | 72.6% | 97.8% |
| Cost to run | £0 | £0 |

- **Keyword rules miss three in ten fraud and lost-card messages.** "Help!
  Someone stole my card!" went to the FAQ bot, because the rule matches
  "stolen", not "stole". So did "Somebody used my card to make a purchase".
  That's how keyword routers fail: customers don't write the words the
  rules were written for.
- **A cheap classic model cuts the harm by 14×.** It trains in about nine
  seconds on a laptop and costs nothing to run.
- **Its mistakes are mostly unsure ones.** On the security tickets it got wrong,
  its average confidence was 0.39, against 0.89 on everything it got right.
  That's the case for a hybrid: let it handle what it's sure of and escalate
  the rest. The exception worth noting is "I cannot find my credit card", routed
  to a top-up FAQ with 0.85 confidence, a confident mistake no threshold would
  catch.

Next: Gemini zero-shot and few-shot on the same test set, the hybrid, and a
one-page memo on what to automate.

## Run it

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m unittest discover -s tests -t .   # routing + scoring tests
.venv/bin/python -m sortcode rules                    # ~1 second
.venv/bin/python -m sortcode tfidf                    # ~2 minutes, mostly cross-validation
.venv/bin/python -m sortcode table
```

Every prediction is saved in `results/predictions/`, one row per test message
with its cost, and every metric in `results/summary.json`, so nothing has to be
taken on trust.

## Where things live

- `sortcode/routing.py`: the 77 intents mapped to five queues, and what each
  kind of mistake costs. The judgement calls are all in this one file.
- `sortcode/evaluate.py`: the scoring every approach goes through.
- `sortcode/models/`: the approaches.

Data: BANKING77 by PolyAI, CC-BY-4.0 (Casanueva et al., 2020). Built with
Claude Code as a pair programmer.
