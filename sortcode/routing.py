"""Where each ticket should go, and what it costs when it goes somewhere else.

Everything here is a judgement call, written down in one place so it can be
argued with. CONTRACT.md explains the reasoning; every report prints the cost
matrix it was scored with.
"""

from .data import intents

# Someone may be taking the customer's money right now. A person, fast.
SECURITY = [
    "compromised_card",
    "lost_or_stolen_card",
    "lost_or_stolen_phone",
    "card_payment_not_recognised",
    "cash_withdrawal_not_recognised",
    "direct_debit_payment_not_recognised",
]

# Money has already gone wrong. A person, with the transaction in front of them.
DISPUTES = [
    "request_refund",
    "Refund_not_showing_up",
    "transaction_charged_twice",
    "extra_charge_on_statement",
    "wrong_amount_of_cash_received",
    "card_payment_wrong_exchange_rate",
    "wrong_exchange_rate_for_cash_withdrawal",
    "reverted_card_payment?",
]

# Something failed or is stuck. Someone has to look at the actual payment:
# the decline code, the processor, the top-up, before they can answer.
PAYMENTS = [
    "declined_card_payment",
    "declined_cash_withdrawal",
    "declined_transfer",
    "failed_transfer",
    "top_up_failed",
    "top_up_reverted",
    "pending_card_payment",
    "pending_cash_withdrawal",
    "pending_top_up",
    "pending_transfer",
    "balance_not_updated_after_bank_transfer",
    "balance_not_updated_after_cheque_or_cash_deposit",
    "transfer_not_received_by_recipient",
    "beneficiary_not_allowed",
    "cancel_transfer",
    "card_not_working",
    "contactless_not_working",
    "virtual_card_not_working",
    "card_swallowed",
    "pin_blocked",
]

# Identity and compliance. A person, working to rules a bot can't apply.
ACCOUNT = [
    "unable_to_verify_identity",
    "verify_source_of_funds",
    "terminate_account",
]

QUEUES = {
    "security": SECURITY,
    "disputes": DISPUTES,
    "payments": PAYMENTS,
    "account": ACCOUNT,
}

# Everything else has a standard answer: fees, how-tos, card orders, limits.
QUEUES["self_serve"] = [
    i for i in intents() if not any(i in members for members in QUEUES.values())
]

QUEUE_OF = {intent: queue for queue, members in QUEUES.items() for intent in members}

HUMAN_QUEUES = {"disputes", "payments", "account"}

# What a routing mistake costs, by (where it belonged, where it went).
COST = {
    "security_missed": 10.0,  # fraud left unattended
    "human_to_bot": 3.0,  # a bot answers a real problem
    "human_to_wrong_human": 1.0,  # bounced between teams
    "bot_wrong_answer": 1.0,  # right queue, wrong canned answer
    "bot_to_security": 1.0,  # false alarm on urgent capacity
    "bot_to_human": 0.5,  # an agent spends time on an FAQ
}


def cost(true_intent: str, pred_queue: str, pred_intent: str | None = None) -> float:
    """The cost of one routing decision.

    `pred_intent` is None for approaches that only pick a queue (keyword rules).
    Those can't name the right canned answer, so a self-serve ticket they route
    to self_serve still counts as a wrong answer.
    """
    true_queue = QUEUE_OF[true_intent]

    if true_queue == "security":
        return 0.0 if pred_queue == "security" else COST["security_missed"]

    if true_queue in HUMAN_QUEUES:
        if pred_queue == true_queue:
            return 0.0
        if pred_queue == "self_serve":
            return COST["human_to_bot"]
        return COST["human_to_wrong_human"]

    # true_queue is self_serve
    if pred_queue == "self_serve":
        return 0.0 if pred_intent == true_intent else COST["bot_wrong_answer"]
    if pred_queue == "security":
        return COST["bot_to_security"]
    return COST["bot_to_human"]
