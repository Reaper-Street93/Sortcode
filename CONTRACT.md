# The Contract — agreed before any code

Sortcode answers one question a support team at a card or payments company
actually has to decide:

> **Which customer messages can a machine safely route or answer on its own,
> which ones must reach a person, and what does each approach cost?**

A sort code sends money to the right bank. Sortcode sends each ticket to the
right queue. This document pins down the data, the approaches, how they're
scored and what comes out, before anything gets built.

## The data

[BANKING77](https://github.com/PolyAI-LDN/task-specific-datasets) from PolyAI:
13,083 real-style customer messages to a card and e-money app, each labelled
with one of 77 intents (`declined_card_payment`, `pending_top_up`,
`compromised_card`…). Licensed CC-BY-4.0. Credit: Casanueva et al., 2020,
*Efficient Intent Detection with Dual Sentence Encoders*.

- **Train:** 10,003 messages, 35–187 per intent. Used for training and for
  choosing few-shot examples. Never scored on.
- **Test:** 3,080 messages, exactly 40 per intent. Every number reported comes
  from here, and nothing is tuned on it.

The test set is balanced; real traffic isn't. Results are reported as they
come, with that caveat stated, not reweighted by a guessed traffic mix.

## From intents to queues

An intent is what the customer wants. A queue is where the ticket goes. Every
one of the 77 intents maps to exactly one of five queues:

| Queue | What it means | Intents |
|---|---|---|
| `security` | Someone may be taking the customer's money right now. A person, fast. | 6 |
| `disputes` | Money has already gone wrong: refunds, double charges, wrong rates. A person. | 8 |
| `payments` | Something failed or is stuck: declines, pending items, cards not working. A person who can look at the transaction. | 20 |
| `account` | Identity checks that failed, source of funds, closing the account. A person, under compliance rules. | 3 |
| `self_serve` | Questions with a standard answer: fees, how-tos, card orders, limits. Safe to automate. | 40 |

The full intent-by-intent mapping lives in one file, `sortcode/routing.py`.
It is a judgement call from four years of answering these messages at a
prepaid card company, written down so it can be argued with.

## What a mistake costs

Accuracy treats every error the same. Operations doesn't: a stolen card that
gets an FAQ link is a different order of failure from an FAQ that lands on an
agent's desk. Each routing outcome carries a cost:

| The ticket was really… | …and went to | Cost | Why |
|---|---|---|---|
| any queue | the right queue (and, for `self_serve`, the right answer) | 0 | |
| `security` | anywhere else | 10 | Fraud left unattended; money keeps leaving |
| `disputes` / `payments` / `account` | `self_serve` | 3 | A bot answers a real problem; the customer comes back angrier |
| `disputes` / `payments` / `account` | another human queue | 1 | Bounced between teams; a delay |
| `self_serve` | the right queue but the wrong intent | 1 | The bot gives the wrong canned answer |
| `self_serve` | `security` | 1 | A false alarm takes urgent capacity |
| `self_serve` | another human queue | 0.5 | An agent spends time on an FAQ |

Inside a human queue the exact intent doesn't matter: a person reads the
message anyway. Inside `self_serve` it does, because the intent picks the
answer. Keyword rules only pick a queue, so they can never name the right
answer: a self-serve ticket they send to `self_serve` still costs 1. The weights live next to the mapping in `sortcode/routing.py`, and
every report prints the matrix it was scored with.

## The approaches

| | Approach | Predicts | Runs on |
|---|---|---|---|
| A | **Keyword rules**: the legacy router a lot of teams still run | queue only | this machine, free |
| B | **TF-IDF + logistic regression**: classic, cheap, trained on the train set | intent → queue | this machine, free |
| C | **Gemini, zero-shot**: given the 77 intent names and nothing else | intent → queue | Gemini free tier |
| D | **Gemini, few-shot**: the same, plus a few real examples per intent from train | intent → queue | Gemini free tier |
| E | **Hybrid** *(stretch)*: B where it's confident, D where it isn't | intent → queue | both |

The model may only answer with one of the 77 intents. Gemini is held to a JSON
schema with the intent list as an enum, so no answer can be off the list.

*Added before any Gemini result existed:* the free tier allows 20 requests a
day per model, so messages go to Gemini in shuffled batches of 385, eight
requests for the whole test set.

*Changed after two days of trying:* the first-choice model, `gemini-3.6-flash`,
turned away almost every free-tier request as "high demand" and finished only
three of the eight zero-shot batches. The runs use `gemini-3.5-flash-lite`
instead. The switch was about availability, not results. The three finished
Flash batches (1,155 messages) are kept, and the report compares both models on
exactly those messages. A
production system would send one ticket at a time; batching may make the
model slightly worse or slightly better, and the report says so rather than
assuming either.

## How each approach is scored

- **Intent accuracy** and **macro-F1** over the 77 intents (B–E).
- **Queue accuracy**: did the ticket reach the right team (all).
- **Security recall**: of the 240 `security` tickets, how many reached
  `security`. The headline safety number.
- **Harm per 1,000 tickets**: mean cost from the table above × 1,000.
- **Automation rate**: share of tickets routed to `self_serve`, and how many of
  those really belonged there.
- **Cost per 10,000 tickets** and **seconds per ticket**. Local models cost
  nothing to run; for Gemini the token counts are recorded from the API's own
  usage figures and priced at Google's published paid-tier rate on the run
  date, so the free-tier result also shows what it would cost at scale.
- **Worst confusions**: the intent pairs each approach mixes up most, with real
  example messages.

## What comes out

```
results/
  predictions/<approach>.csv   one row per test message: text, true intent,
                               predicted intent (or queue), true queue,
                               predicted queue, cost
  summary.json                 every metric above, per approach, plus the run
                               date, model names, prompt version and the cost
                               matrix used
REPORT.md                      the one-page memo: what to automate, what must
                               reach a person, and what it costs
```

Gemini predictions are saved and committed, so every number can be re-scored
without an API key or any spend, and nobody has to take a result on trust.

## Ground rules

- **£0.** Gemini free tier only. The key lives in `.env`, which is never
  committed.
- **The test set is touched once per approach**, after everything about that
  approach is fixed. No tuning against test numbers.
- **Seeds are fixed**, and every library version is pinned in
  `requirements.txt`.
- **Out of scope for now:** fine-tuning transformer models, real customer data,
  and a live demo page. Each could follow once the benchmark is done.
