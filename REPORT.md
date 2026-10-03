# What to automate on a card-support desk

*Sortcode memo, October 2026. 3,080 test messages from BANKING77, five
approaches, each scored once after it was frozen. Method: [CONTRACT.md](CONTRACT.md).*

## The short version

1. **Retire keyword routing.** It sent 70 of 240 fraud and lost-card messages
   to the wrong place, including "Help! Someone stole my card!", which went to
   the FAQ bot.
2. **Route with a trained classic model.** It costs nothing, answers in
   microseconds and cuts the harm 14× against the rules. Given labelled
   tickets, an LLM didn't beat it.
3. **Let the bot answer only when the model is sure, and send everything else
   to a person.** About one ticket in five is "unsure". On those, every
   approach tested picks the wrong intent about a third of the time.

## The numbers

| | Rules | TF-IDF + logistic regression | Gemini zero-shot | Gemini few-shot | Hybrid |
|---|---:|---:|---:|---:|---:|
| Right intent | — | 91.5% | 75.4% | 86.2% | **91.9%** |
| Right queue | 78.4% | 96.7% | 91.2% | 95.6% | **97.1%** |
| Fraud and lost-card missed (of 240) | 70 | 6 | 15 | 7 | **5** |
| Harm per 1,000 tickets | 1,253 | **91** | 308 | 159 | 98 |
| Cost per 10,000 tickets | $0 | $0 | $0.59 | $0.61 | $0.12 |

*Harm* weights each mistake by what it costs the business: a missed fraud
ticket costs 10, a real problem answered by a bot 3, an FAQ landing on an agent
0.5. Gemini is `gemini-3.5-flash-lite`, priced at Google's paid rate, though
these runs cost £0 on the free tier. The hybrid uses TF-IDF when it's at least
77% confident (about 80% of tickets) and Gemini few-shot for the rest.

## What the numbers say

**The LLM reads the question; an agent hears the problem.** Gemini's most
expensive habit was answering "How long for money transfer to show?" as a
timing FAQ. In this dataset that customer has a transfer that hasn't arrived,
and the right answer is someone looking at the payment. On the 612 hardest
tickets, Gemini was slightly more accurate than TF-IDF but sent nearly twice as
many real problems to the bot. That's why the hybrid has the best accuracy and
the fewest fraud misses, yet slightly more harm than TF-IDF alone.

**Examples matter more than model size.** Showing Gemini three real tickets per
intent lifted it from 75% to 86% and halved its harm. Part of that is learning
the dataset's own conventions: "What do I do with my card PIN?" is labelled as
getting a physical card, which no model would guess from the label names alone.

**A stronger model narrows the gap but doesn't close it.** On the 1,155
messages both were run on, `gemini-3.6-flash` zero-shot scored 83% against
Flash-Lite's 78%. TF-IDF scored 91% on those same messages.

**Cost doesn't decide this.** At list price, Gemini handles 10,000 tickets for
about 60 cents. What separates the approaches is how many fraud tickets reach
the wrong desk (from 5 to 70 of 240), not the money.

## What I'd do

- **Security:** the classic model, with the old keyword rules kept as a
  tripwire: anything they flag goes to the security queue even when the model
  disagrees. On this test set that cut fraud misses from 6 to 4 for 25 false
  alarms. I checked it after the fact rather than freezing it in advance, so
  treat it as indicative. A false alarm costs a tenth of a missed fraud.
- **Self-serve:** automate only above the confidence bar. That's 43% of all
  tickets, and TF-IDF picked the right answer for 97.9% of them.
- **The unsure fifth:** a human triage queue, not an LLM. Keep Gemini for a
  cold start, a new product with no labelled tickets yet, where zero-shot
  still routes 91% correctly.

## What this doesn't show

- **The test set is balanced.** It has 40 messages per intent, so security
  tickets make up 8% of it; real traffic skews differently and harm totals would shift.
- **BANKING77 messages are short, single-issue and in English.** Real tickets
  ramble, mix issues and come with account history a model could use.
- **Gemini saw 385 messages per request**, because the free tier allows 20
  requests a day. A live system would send one at a time, and the results
  could differ either way.
- **The harm weights are judgement calls**, from four years of answering these
  messages. They live in [`sortcode/routing.py`](sortcode/routing.py), and
  changing them and re-scoring takes seconds.
- **Prices are as of October 2026.** Flash-Lite costs $0.30 per million input
  tokens and $2.50 per million output tokens.

Every prediction behind these numbers is in [`results/`](results), so any of
them can be checked without an API key.
