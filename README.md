# Sortcode

Which customer messages to a card company can a machine safely route or answer
on its own, which must reach a person, and what does each approach cost?

A sort code sends money to the right bank. Sortcode sends each support ticket
to the right queue, then scores every approach by **what its mistakes would
cost the business**, not just by accuracy. A stolen card that gets an FAQ link
is a different order of failure from an FAQ that lands on an agent's desk.

**Try it: [reaper-street93.github.io/Sortcode](https://reaper-street93.github.io/Sortcode/)**.
Type a customer message and see where each approach sends it, or browse all
3,080 test messages and what every mistake cost. The model runs in your
browser, so nothing you type leaves the page.

**Applied: [a triage desk for a prepaid travel card](https://reaper-street93.github.io/Sortcode/caxton/)**.
Modelled on Caxton's Currency Card using only public information: each message
gets a team, where to look (Thredd's Smart Client, the Checkout.com dashboard),
a decline code lookup and a reply starter, every fact linked to its source.
Independent, and not affiliated with Caxton, Thredd or Checkout.com.

The spec came first: [CONTRACT.md](CONTRACT.md) sets out the queues, the cost
of each kind of mistake and the metrics, all fixed before any code.

## Results

3,080 test messages from [BANKING77](data/README.md), 40 for each of 77
intents. Each approach was scored on the test set once, after it was frozen.
**The write-up: [REPORT.md](REPORT.md).**

| | Rules | TF-IDF + logistic regression | Gemini zero-shot | Gemini few-shot | Hybrid |
|---|---:|---:|---:|---:|---:|
| Right intent | — | 91.5% | 75.4% | 86.2% | **91.9%** |
| Right queue | 78.4% | 96.7% | 91.2% | 95.6% | **97.1%** |
| **Fraud and lost-card missed (of 240)** | 70 | 6 | 15 | 7 | **5** |
| **Harm per 1,000 tickets** | 1,253 | **91** | 308 | 159 | 98 |
| Cost per 10,000 tickets | $0 | $0 | $0.59 | $0.61 | $0.12 |

- **Keyword rules miss three in ten fraud and lost-card messages.** "Help!
  Someone stole my card!" went to the FAQ bot, because the rule matches
  "stolen", not "stole".
- **A free classic model cuts the harm 14×** and, given labelled tickets, an
  LLM didn't beat it.
- **The LLM reads the question; an agent hears the problem.** Gemini answered
  "How long for money transfer to show?" as a timing FAQ, when that customer's
  transfer hasn't arrived. On the hardest tickets it sent nearly twice as many
  real problems to the bot, which is why the hybrid has the best accuracy and
  the fewest fraud misses, yet slightly more harm than TF-IDF alone.
- **Three examples per intent lifted Gemini from 75% to 86%** and roughly
  halved its harm. A stronger model (`gemini-3.6-flash`, 83% zero-shot on the
  1,155 messages it finished) narrows the gap to TF-IDF without closing it.

Gemini is `gemini-3.5-flash-lite`, sent 385 messages per request because the
free tier allows 20 requests a day; [CONTRACT.md](CONTRACT.md) records why and
when that changed.

## Run it

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m unittest discover -s tests -t .   # routing + scoring tests
.venv/bin/python -m sortcode rules                    # ~1 second
.venv/bin/python -m sortcode tfidf                    # ~2 minutes, mostly cross-validation
.venv/bin/python -m sortcode zero                     # Gemini, needs GEMINI_API_KEY in .env
.venv/bin/python -m sortcode few
.venv/bin/python -m sortcode hybrid                   # reuses saved predictions, no API calls
.venv/bin/python -m sortcode table
.venv/bin/python -m sortcode demo                     # export the model + results for the demo page
node tests/check_demo_model.mjs                       # browser model vs Python, all 3,080 messages
node tests/check_desk.mjs                             # card desk: every intent has a playbook, every fact a source
```

Every prediction is saved in `results/predictions/`, one row per test message
with its cost, every metric in `results/summary.json`, and every raw Gemini
response in `results/raw/`, so nothing has to be taken on trust and nothing
needs a key to re-score.

## Where things live

- `sortcode/routing.py`: the 77 intents mapped to five queues, and what each
  kind of mistake costs. The judgement calls are all in this one file.
- `sortcode/evaluate.py`: the scoring every approach goes through.
- `sortcode/models/`: the approaches.
- `docs/`: the demo page, served by GitHub Pages. `docs/model.js` is the TF-IDF
  model ported to JavaScript; `tests/check_demo_model.mjs` checks it gives the
  same answer as Python on every test message.

Data: BANKING77 by PolyAI, CC-BY-4.0 (Casanueva et al., 2020). Built with
Claude Code as a pair programmer.
