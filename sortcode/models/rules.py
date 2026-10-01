"""Approach A: the keyword router a lot of support teams still run.

First match wins, checked in order of how bad it is to miss: security, then
account, disputes and payments. Anything that matches nothing goes to
self_serve. It only ever picks a queue, never an intent.

Written from what these messages look like on a support desk, then given one
tidy-up pass against the training set (the kind of pass a team does after
reviewing missed tickets). Frozen before the test set was scored.
"""

import re

RULES = [
    ("security", [
        r"\b(stolen|lost|theft|thief|missing|misplaced)\b.{0,40}\b(card|phone|wallet|purse|bag)\b",
        r"\b(card|phone|wallet|purse|bag)\b.{0,40}\b(stolen|lost|theft|missing|misplaced)\b",
        r"\b(don'?t|do not|didn'?t|did not|never)\s+(recogni[sz]e|make|made|authori[sz]e|remember|do|did)\b",
        r"\b(unauthori[sz]ed|fraud\w*|hacked|scam\w*|compromised)\b",
        r"\bsomeone\b.{0,30}\b(used|using|took|taken|withdrew|has my|got my)\b",
        r"\b(strange|weird|suspicious|unknown|unfamiliar|odd)\b.{0,30}\b(payment|charge|transaction|withdrawal|debit)",
        r"\bnot mine\b",
        r"\b(freez\w*|block)\b.{0,15}\bcard\b",
        r"\b(mugged|robbed|pickpocket\w*|nicked)\b",
        r"\b(money|funds|cash)\b.{0,15}\bmissing\b|\bmissing\b.{0,15}\b(money|funds|cash)\b",
        r"\b(someone|somebody)\b.{0,20}\b(charged|spent|accessed|withdr\w*)\b",
        r"\b(didn'?t|did not|never)\b.{0,15}\b(purchase|buy|bought|withdraw|take out|took out|set up)\b",
        r"\b(can'?t|cannot)\s+find\b.{0,15}\b(phone|card|wallet)\b",
    ]),
    ("account", [
        r"\b(close|delete|terminate|cancel|remove|shut)\b.{0,25}\baccount\b",
        r"\bsource of (my |the )?(funds|money)\b",
        r"\b(can'?t|cannot|unable to|won'?t let me|failed to|trouble|problem)\b.{0,30}\bverif",
        r"\b(difficult\w*|issue|struggl\w*|missing|not have|don'?t have)\b.{0,30}\bverif",
        r"\bwhere\b.{0,25}\b(funds|money)\b.{0,15}\b(come|came|from)\b",
        r"\b(finish\w* up|done) with\b.{0,15}\baccount\b",
    ]),
    ("disputes", [
        r"\brefund",
        r"\b(charged|billed|paid|debited)\b.{0,20}\b(twice|two times|double)\b|\bdouble.?charg|\bduplicate",
        r"\b(wrong|incorrect|bad|unfair|terrible)\b.{0,25}\brate\b|\brate\b.{0,20}\b(wrong|incorrect|off)\b",
        r"\b(wrong|incorrect)\b.{0,10}\bamount\b|\bnot (the )?(right|correct|full) amount\b|\bless (cash|money) than\b",
        r"\b(extra|unexpected|unknown)\b.{0,10}\b(charge|fee)\b.{0,30}\bstatement\b",
        r"\b(payment|transaction|purchase)\b.{0,25}\b(reverted|reversed|returned)\b",
        r"\b(payment|transaction|purchase)\b.{0,25}\b(has been|was|got)\s+cancel+ed\b",
        r"\b(only|just)\s+(gave|got|received|dispensed)\b|\b(didn'?t|did not)\s+(get|receive)\s+the\s+(right|correct|full)\b",
        r"\bexchange\b.{0,40}\b(wrong|incorrect\w*|miscalculated|unfair)\b|\b(incorrectly|wrongly)\b.{0,30}\b(rate|exchange)\b",
    ]),
    ("payments", [
        r"\b(declin\w*|reject\w*|denied|refus\w*)\b",
        r"\b(fail\w*)\b|\b(didn'?t|won'?t|doesn'?t|isn'?t|not|stopped)\b.{0,10}\b(go(ing)? through|work\w*)\b",
        r"\bpending\b|\bon hold\b|\bstuck\b",
        r"\b(hasn'?t|has not|haven'?t|have not|not yet|never|still not|isn'?t)\b.{0,15}\b(arrived|received|showing|shown|show(n)? up|updated|reflect\w*|come through|gone through|credited)\b",
        r"\b(atm|machine)\b.{0,40}\b(kept|ate|swallowed|took|stole|has|keep)\b.{0,10}\bcard\b|\bswallow",
        r"\bpin\b.{0,20}\b(blocked|locked)\b|\b(blocked|locked)\b.{0,20}\bpin\b|\bunblock",
        r"\bcancel\w*\b.{0,25}\b(transfer|payment|transaction)\b",
        r"\b(beneficiary|payee)\b",
        r"\b(not|isn'?t|aren'?t)\b.{0,10}\b(available|posted|accepted)\b",
        r"\bhow long\b.{0,40}\b(show|appear|reflect\w*|clear|credited|post)\b",
        r"\bstill\b.{0,20}\b(in progress|processing)\b",
        r"\b(top.?up|deposit)\b.{0,30}\b(reverted|cancel+ed|returned|bounced)\b",
        r"\b(hasn'?t|has not|hadn'?t|didn'?t|did not|never)\b.{0,20}\b(receiv\w*|get|got)\b.{0,20}\b(money|transfer|payment|funds)\b",
        r"\b(can'?t|cannot|unable to|won'?t let me)\b.{0,20}\b(withdraw|take out|get (my )?(cash|money)|pay|purchase|buy|top.?up|transfer|send)\b",
        r"\b(undo|revert|stop|recall)\b.{0,25}\b(transfer|payment|transaction)\b",
    ]),
]

COMPILED = [(queue, [re.compile(p, re.IGNORECASE) for p in patterns]) for queue, patterns in RULES]


def route(text: str) -> str:
    for queue, patterns in COMPILED:
        if any(p.search(text) for p in patterns):
            return queue
    return "self_serve"
